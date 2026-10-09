"""Business API; ComfyUI owns model loading and inference."""
import asyncio
from contextlib import asynccontextmanager, suppress
import io
import os
from pathlib import Path
import sys
import zipfile

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from backend.comfy_client import ComfyClient
from backend.queue_service import QueueService
from backend.task_store import TaskStore
from backend.workflows import WorkflowRegistry

ROOT = Path(__file__).resolve().parent
OUTPUTS = ROOT / 'static' / 'outputs'
COMFY_URL = os.environ.get('COMFYUI_URL', 'http://127.0.0.1:8188').rstrip('/')
DEDICATED = os.environ.get('COMFYUI_DEDICATED', '0') == '1'


@asynccontextmanager
async def lifespan(app):
    store = TaskStore(ROOT / 'data' / 'studio.sqlite3')
    client = ComfyClient(COMFY_URL)
    app.state.service = QueueService(store, client, WorkflowRegistry(ROOT / 'workflows'), OUTPUTS, DEDICATED)
    workers = [asyncio.create_task(service().run()), asyncio.create_task(service().listen())]
    try:
        yield
    finally:
        for task in workers:
            task.cancel()
        for task in workers:
            with suppress(asyncio.CancelledError):
                await task
        service().save()
        store.close()
        await client.close()


app = FastAPI(title='Local Image Studio · ComfyUI', lifespan=lifespan)


class QueueAddRequest(BaseModel):
    prompts: list[str] = Field(min_length=1, max_length=1000)
    images_per_prompt: int = Field(default=1, ge=1, le=100, strict=True)
    workflow_id: str = 'z-image-turbo'
    seed: int = Field(default=-1, ge=-1, le=2**53-1)
    height: int = Field(default=1024, ge=64, le=4096, multiple_of=8)
    width: int = Field(default=1024, ge=64, le=4096, multiple_of=8)
    steps: int | None = Field(default=None, ge=1, le=100)
    guidance_scale: float | None = Field(default=None, ge=0, le=30)
    front: bool = False


def service():
    return app.state.service


class QueueModelRequest(BaseModel):
    workflow_id: str


async def operation(coro):
    try:
        return await coro
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(503, f'Cannot reach ComfyUI: {exc}') from exc


@app.get('/api/status')
async def status():
    s = service()
    try:
        stats = await s.client.get('/system_stats', timeout=3)
        online, error = True, s.error
    except Exception as exc:
        stats, online, error = {}, False, f'ComfyUI unavailable at {COMFY_URL}: {exc}'
    return {'status': 'online' if online else 'offline', 'backend': 'comfyui',
        'comfyui_url': COMFY_URL, 'dedicated': DEDICATED, 'error': error,
        'device': stats.get('devices', []), 'memory_layout': 'Managed by ComfyUI',
        'is_busy': any(t['status'] in ('generating', 'submitting') for t in s.tasks)}


@app.get('/health')
async def health():
    return {'status': 'ok', 'backend': 'comfyui'}


@app.get('/api/workflows')
async def workflows():
    s = service()
    try:
        info = await s.client.get('/object_info')
    except Exception:
        info = None
    entries = []
    for item in s.registry.entries:
        graph = s.registry.build(item['id'], {**item['defaults'], 'prompt': '', 'seed': 0})
        problems = s.registry.problems(graph, info) if info is not None else ['ComfyUI is offline']
        entries.append({**item, 'available': not problems, 'problems': problems})
    return {'workflows': entries, 'backend_url': COMFY_URL}


@app.get('/api/queue')
async def get_queue():
    s = service()
    return {'status': s.status, 'error': s.error, 'queue': [
        {**s.public(t), 'progress': s.progress.get(t.get('prompt_id'), {})}
        for t in s.tasks if t.get('visible', True)]}


@app.get('/api/gallery')
async def gallery():
    s = service()
    return {'images': [{**s.public(t), 'filename': filename}
        for t in s.tasks if t['status'] == 'completed' for filename in t.get('filenames', [t['filename']])]}


@app.post('/api/queue/add')
async def add(req: QueueAddRequest):
    if len(req.prompts) * req.images_per_prompt > 1000:
        raise HTTPException(422, '每批最多生成 1000 张图片，请减少提示词或每条生成数量。')
    if any(not p.strip() or len(p) > 20000 for p in req.prompts):
        raise HTTPException(422, 'Prompts must be nonempty and at most 20000 characters')
    return {'success': True, 'added': await operation(service().add(req.model_dump()))}


@app.post('/api/queue/pause')
async def pause():
    await service().pause()
    return {'success': True, 'status': service().status}


@app.post('/api/queue/resume')
async def resume():
    await operation(service().resume())
    return {'success': True, 'status': service().status}


@app.post('/api/queue/stop')
async def stop():
    await operation(service().stop())
    return {'success': True, 'status': service().status}


@app.post('/api/queue/clear')
async def clear():
    await operation(service().mutate('clear'))
    return {'success': True}


@app.post('/api/queue/model')
async def switch_queue_model(req: QueueModelRequest):
    result = await operation(service().switch_model(req.workflow_id))
    return {'success': True, **result}


@app.post('/api/queue/clear-completed')
async def clear_completed():
    await operation(service().mutate('clear-completed'))
    return {'success': True}


@app.post('/api/queue/shuffle')
async def shuffle():
    count = await operation(service().mutate('shuffle'))
    return {'success': True, 'shuffled': count}


@app.delete('/api/queue/{task_id}')
async def delete(task_id: str):
    await operation(service().mutate('delete', task_id))
    return {'success': True}


@app.post('/api/queue/{task_id}/skip')
async def skip(task_id: str):
    await operation(service().mutate('skip', task_id))
    return {'success': True}


@app.post('/api/queue/{task_id}/move-front')
async def move(task_id: str):
    await operation(service().mutate('move-front', task_id))
    return {'success': True}


@app.get('/api/outputs/zip')
async def download_all():
    files = list(OUTPUTS.glob('*.png'))
    if not files:
        raise HTTPException(400, 'No images to download')
    def package():
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
            for path in files:
                archive.write(path, path.name)
        buffer.seek(0)
        return buffer
    return StreamingResponse(await asyncio.to_thread(package), media_type='application/zip',
        headers={'Content-Disposition': 'attachment; filename=all_images.zip'})


@app.post('/api/open-folder')
async def open_folder():
    os.startfile(str(OUTPUTS))
    return {'success': True, 'path': str(OUTPUTS)}


@app.post('/api/restart')
async def restart():
    async def later():
        await asyncio.sleep(0.6)
        service().save()
        os.execv(sys.executable, [sys.executable] + sys.argv)
    asyncio.create_task(later())
    return {'success': True}


@app.post('/api/shutdown')
async def shutdown():
    async def later():
        await asyncio.sleep(0.6)
        service().save()
        os._exit(0)
    asyncio.create_task(later())
    return {'success': True}


@app.get('/')
async def index():
    return FileResponse(ROOT / 'static' / 'index.html')


@app.get('/index.css')
async def css():
    return FileResponse(ROOT / 'static' / 'index.css')


@app.get('/index.js')
async def js():
    return FileResponse(ROOT / 'static' / 'index.js')


@app.get('/outputs/{filename}')
async def output(filename: str):
    path = (OUTPUTS / filename).resolve()
    if path.parent != OUTPUTS.resolve() or not path.is_file() or path.suffix != '.png':
        raise HTTPException(404, 'Image not found')
    return FileResponse(path)
