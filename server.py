import os
import time
import uuid
import asyncio
import torch
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
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

db_queue = []  # List of QueueItem
queue_status = "idle"  # "idle", "running", "paused"
cancel_flag = False

OUTPUTS_DIR = os.path.join("static", "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)

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
            # Free VRAM cache before generation
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
            generator = torch.Generator("cpu").manual_seed(seed)
            
            # Step callback ends execution immediately if cancel_flag is set
            def step_callback(pipeline, step_index, timestep, callback_kwargs):
                global cancel_flag
                if cancel_flag:
                    raise RuntimeError("cancelled")
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
            filename = f"gen_{uuid.uuid4().hex}.png"
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
        db_queue.append(item)
        added_items.append(item)
    
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
