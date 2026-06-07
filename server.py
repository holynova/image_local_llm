import os
import sys
import re
import time
import uuid
import asyncio
import torch
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse
import zipfile
import io

from pydantic import BaseModel, Field
from diffusers import ZImagePipeline

# Optimize PyTorch settings for RTX 5070 Ti (Blackwell)
torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32 = True

app = FastAPI(title="Z-Image-Turbo Local Server")

# Global variables for pipeline
pipe = None

# Backend Queue State
class QueueItem(BaseModel):
    id: str
    prompt: str
    width: int
    height: int
    steps: int
    guidance_scale: float
    seed: int
    status: str  # "pending", "generating", "completed", "failed"
    elapsed: float = 0.0
    filename: str = ""
    seed_used: int = -1
    error_msg: str = ""

class QueueAddRequest(BaseModel):
    prompts: list[str]
    seed: int = Field(default=-1)
    height: int = Field(default=1024)
    width: int = Field(default=1024)
    steps: int = Field(default=9)
    guidance_scale: float = Field(default=0.0)
    front: bool = Field(default=False)

db_queue = []  # List of QueueItem
queue_status = "idle"  # "idle", "running", "paused"
cancel_flag = False

OUTPUTS_DIR = os.path.join("static", "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)

def _has_cjk(text: str) -> bool:
    """Return True if text contains CJK (Chinese/Japanese/Korean) characters."""
    for ch in text:
        cp = ord(ch)
        if (0x4E00 <= cp <= 0x9FFF or   # CJK Unified Ideographs
                0x3400 <= cp <= 0x4DBF or   # CJK Extension A
                0xF900 <= cp <= 0xFAFF or   # CJK Compatibility Ideographs
                0xAC00 <= cp <= 0xD7AF):    # Korean Hangul
            return True
    return False


def _cjk_to_slug(text: str) -> str:
    """Convert CJK text to a slug: try Google Translate first, fallback to pinyin."""
    # --- Strategy 1: online translation ---
    try:
        from deep_translator import GoogleTranslator
        translated = GoogleTranslator(source='auto', target='en').translate(text[:200])
        if translated:
            return translated
    except Exception:
        pass  # network unavailable or package missing

    # --- Strategy 2: pinyin romanisation (offline) ---
    try:
        from pypinyin import lazy_pinyin
        pinyin_parts = lazy_pinyin(text)
        return ' '.join(pinyin_parts)
    except Exception:
        pass

    # --- Strategy 3: deterministic hash fallback ---
    import hashlib
    return 'prompt-' + hashlib.md5(text.encode('utf-8')).hexdigest()[:8]


def _make_slug(text: str, max_len: int = 40) -> str:
    """Turn arbitrary text into a URL/filename-safe slug."""
    # Translate CJK text first
    if _has_cjk(text):
        text = _cjk_to_slug(text)

    slug = text.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)  # non-alphanumeric → hyphen
    slug = slug.strip('-')
    slug = slug[:max_len]
    slug = slug.rstrip('-')
    return slug or 'image'


def make_filename(prompt: str, seed: int) -> str:
    """Generate a human-readable filename from the prompt and seed.

    Format : YYYYMMDD_HHMMSS_<slug>_s<seed>.png
    English: 20240607_143022_a-beautiful-sunset_s837421.png
    Chinese: 20240607_143022_beautiful-mountain-landscape_s291847.png  (translated)
             20240607_143022_mei-li-shan-shui_s291847.png              (pinyin fallback)
    """
    ts   = time.strftime("%Y%m%d_%H%M%S")
    slug = _make_slug(prompt, max_len=40)
    return f"{ts}_{slug}_s{seed}.png"

# Background Worker Thread Loop
async def queue_worker():
    global db_queue, queue_status, cancel_flag, pipe
    print("[Worker] Background worker loop started.")
    
    while True:
        await asyncio.sleep(0.2)
        if queue_status != "running":
            continue
            
        # Find first pending item
        active_item = None
        for item in db_queue:
            if item.status == "pending":
                active_item = item
                break
                
        if active_item is None:
            queue_status = "idle"
            continue
            
        # Found pending task - run it
        active_item.status = "generating"
        cancel_flag = False
        start_time = time.time()
        
        # Resolve seed
        seed = active_item.seed
        if seed == -1:
            seed = int(torch.randint(0, 1000000, (1,)).item())
            
        # Define synchronous inference worker to run in a thread pool
        def inference_wrapper():
            active_item.elapsed = round(time.time() - start_time, 1)
            # Free VRAM cache before generation
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
            generator = torch.Generator("cpu").manual_seed(seed)
            
            # Step callback ends execution immediately if cancel_flag is set
            def step_callback(pipeline, step_index, timestep, callback_kwargs):
                global cancel_flag
                if cancel_flag:
                    raise RuntimeError("cancelled")
                active_item.elapsed = round(time.time() - start_time, 1)
                return callback_kwargs
            
            image = pipe(
                prompt=active_item.prompt,
                height=active_item.height,
                width=active_item.width,
                num_inference_steps=active_item.steps,
                guidance_scale=active_item.guidance_scale,
                generator=generator,
                callback_on_step_end=step_callback
            ).images[0]
            
            # Save generated PNG
            filename = make_filename(active_item.prompt, seed)
            filepath = os.path.join(OUTPUTS_DIR, filename)
            image.save(filepath)
            
            # Free VRAM cache after generation
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
            return filename

        try:
            # Run blocking PyTorch code in a separate thread so event loop remains free
            filename = await asyncio.to_thread(inference_wrapper)
            elapsed = time.time() - start_time
            
            active_item.status = "completed"
            active_item.filename = filename
            active_item.elapsed = round(elapsed, 2)
            active_item.seed_used = seed
            print(f"[Worker] Task completed in {elapsed:.2f}s: '{active_item.prompt}'")
            
        except Exception as e:
            elapsed = time.time() - start_time
            if "cancelled" in str(e):
                active_item.status = "pending"
                active_item.elapsed = 0.0
                print(f"[Worker] Task cancelled by user after {elapsed:.2f}s: '{active_item.prompt}'")
            else:
                import traceback
                traceback.print_exc()
                active_item.status = "failed"
                active_item.error_msg = str(e)
                print(f"[Worker] Task failed after {elapsed:.2f}s: '{active_item.prompt}'. Error: {e}")

@app.on_event("startup")
def load_model():
    global pipe
    print("============================================================")
    print("Loading Z-Image-Turbo pipeline (unquantized BF16)...")
    print("============================================================")
    try:
        pipe = ZImagePipeline.from_pretrained(
            "Tongyi-MAI/Z-Image-Turbo",
            torch_dtype=torch.bfloat16,
            low_cpu_mem_usage=True
        )
        
        print("Configuring Hybrid CPU/GPU execution layout...")
        # Keep text encoder on CPU to save 9.4GB VRAM
        pipe.text_encoder.to("cpu")
        # Keep VAE on CPU to save VRAM
        pipe.vae.to("cpu")
        # Keep 12GB Transformer on CUDA GPU
        pipe.transformer.to("cuda")
        
        # Enable attention slicing to reduce peak GPU memory usage
        pipe.enable_attention_slicing()
        
        print("Model loaded successfully into Hybrid CPU/GPU memory!")
        print("============================================================")
        
        # Start backend queue worker loop task
        asyncio.create_task(queue_worker())
        
    except Exception as e:
        print(f"CRITICAL ERROR loading pipeline: {e}")
        raise e

# Server status endpoint
@app.get("/api/status")
async def get_status():
    return {
        "status": "online",
        "device": "cuda (RTX 5070 Ti)",
        "memory_layout": "hybrid (CPU TextEncoder/VAE + GPU Transformer)",
        "is_busy": queue_status == "running"
    }

@app.post("/api/restart")
async def restart_server():
    """Restart the server process by re-executing itself."""
    async def _do_restart():
        await asyncio.sleep(0.6)  # Give time for HTTP response to be flushed
        os.execv(sys.executable, [sys.executable] + sys.argv)
    asyncio.create_task(_do_restart())
    return {"success": True, "message": "Server is restarting..."}

@app.post("/api/shutdown")
async def shutdown_server():
    """Shut down the server process."""
    async def _do_shutdown():
        await asyncio.sleep(0.6)  # Give time for HTTP response to be flushed
        os._exit(0)
    asyncio.create_task(_do_shutdown())
    return {"success": True, "message": "Server is shutting down..."}

# Queue Management APIs
@app.get("/api/queue")
async def get_queue():
    global db_queue, queue_status
    return {
        "status": queue_status,
        "queue": [item.dict() for item in db_queue]
    }

@app.post("/api/queue/add")
async def add_to_queue(req: QueueAddRequest):
    global db_queue, queue_status
    added_items = []
    for p in req.prompts:
        item = QueueItem(
            id="task_" + uuid.uuid4().hex[:9],
            prompt=p,
            width=req.width,
            height=req.height,
            steps=req.steps,
            guidance_scale=req.guidance_scale,
            seed=req.seed,
            status="pending"
        )
        added_items.append(item)
    
    if req.front:
        for item in reversed(added_items):
            db_queue.insert(0, item)
    else:
        db_queue.extend(added_items)
    
    # Auto-start queue if idle
    if queue_status == "idle":
        queue_status = "running"
        
    return {"success": True, "added": [item.dict() for item in added_items]}

@app.post("/api/queue/pause")
async def pause_queue():
    global queue_status
    if queue_status == "running":
        queue_status = "paused"
    return {"success": True, "status": queue_status}

@app.post("/api/queue/resume")
async def resume_queue():
    global queue_status
    queue_status = "running"
    return {"success": True, "status": queue_status}

@app.post("/api/queue/stop")
async def stop_queue():
    global queue_status, cancel_flag, db_queue
    cancel_flag = True
    queue_status = "paused"
    
    # Reset the currently generating item back to pending
    for item in db_queue:
        if item.status == "generating":
            item.status = "pending"
            item.elapsed = 0.0
            
    return {"success": True, "status": queue_status}

@app.post("/api/queue/clear")
async def clear_queue():
    global db_queue, queue_status, cancel_flag
    cancel_flag = True
    db_queue = []
    queue_status = "idle"
    return {"success": True, "status": queue_status}

@app.post("/api/queue/clear-completed")
async def clear_completed_tasks():
    """Remove all completed/failed/skipped tasks from the queue (keeps files intact)."""
    global db_queue, queue_status
    db_queue = [item for item in db_queue if item.status in ("pending", "generating")]
    if not db_queue and queue_status != "running":
        queue_status = "idle"
    return {"success": True, "remaining": len(db_queue)}

@app.delete("/api/queue/{task_id}")
async def delete_task(task_id: str):
    """Delete any non-generating task from the queue."""
    global db_queue
    # Find the task first to give a meaningful error
    target = next((item for item in db_queue if item.id == task_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found in queue")
    if target.status == "generating":
        raise HTTPException(status_code=409, detail="Cannot delete a task that is currently generating")
    db_queue = [item for item in db_queue if item.id != task_id]
    return {"success": True}

@app.post("/api/queue/{task_id}/skip")
async def skip_task(task_id: str):
    """Mark any non-generating, non-completed task as skipped."""
    global db_queue
    target = next((item for item in db_queue if item.id == task_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found in queue")
    if target.status in ("generating", "completed", "skipped"):
        raise HTTPException(status_code=409, detail=f"Cannot skip task in '{target.status}' state")
    target.status = "skipped"
    return {"success": True}

@app.post("/api/queue/{task_id}/move-front")
async def move_task_to_front(task_id: str):
    """Move a pending task to the front of the queue."""
    global db_queue
    target = None
    for item in db_queue:
        if item.id == task_id and item.status == "pending":
            target = item
            break
    if target is None:
        raise HTTPException(status_code=404, detail="Task not found or not in pending state")
    db_queue.remove(target)
    # Insert after any currently generating item
    insert_pos = 0
    for i, item in enumerate(db_queue):
        if item.status == "generating":
            insert_pos = i + 1
            break
    db_queue.insert(insert_pos, target)
    return {"success": True}

@app.get("/api/outputs/zip")
async def download_all_images():
    global OUTPUTS_DIR
    png_files = [f for f in os.listdir(OUTPUTS_DIR) if f.endswith(".png")]
    if not png_files:
        raise HTTPException(status_code=400, detail="No images found to download")
    
    zip_io = io.BytesIO()
    with zipfile.ZipFile(zip_io, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for filename in png_files:
            filepath = os.path.join(OUTPUTS_DIR, filename)
            zip_file.write(filepath, filename)
            
    zip_io.seek(0)
    return StreamingResponse(
        zip_io,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=all_images.zip"}
    )

@app.post("/api/open-folder")
async def open_local_folder():
    global OUTPUTS_DIR
    abs_path = os.path.abspath(OUTPUTS_DIR)
    if os.path.exists(abs_path):
        try:
            os.startfile(abs_path)
            return {"success": True, "path": abs_path}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to open folder: {str(e)}")
    else:
        raise HTTPException(status_code=404, detail="Outputs directory does not exist")

# Static files routes
@app.get("/")
async def get_index():
    return FileResponse("static/index.html")

@app.get("/index.css")
async def get_css():
    return FileResponse("static/index.css")

@app.get("/index.js")
async def get_js():
    return FileResponse("static/index.js")

@app.get("/outputs/{filename}")
async def get_output_image(filename: str):
    filepath = os.path.join(OUTPUTS_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)
