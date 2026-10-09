"""Run explicitly against ComfyUI. Tests transport/output, not AI model quality."""
import asyncio
import os
from pathlib import Path
import tempfile
import time

from backend.comfy_client import ComfyClient
from backend.queue_service import QueueService
from backend.task_store import TaskStore
from backend.workflows import WorkflowRegistry


class SmokeRegistry:
    by_id = {'smoke': {'defaults': {'width': 64, 'height': 64, 'steps': 1, 'guidance_scale': 1},
                      'output_nodes': ['2']}}
    problems = staticmethod(WorkflowRegistry.problems)

    def build(self, workflow_id, params):
        return {
            '1': {'class_type': 'EmptyImage', 'inputs': {'width': params['width'],
                  'height': params['height'], 'batch_size': 1, 'color': 0x4AA8FF}},
            '2': {'class_type': 'SaveImage', 'inputs': {'images': ['1', 0],
                  'filename_prefix': 'studio_transport_smoke'}}
        }


async def main():
    client = ComfyClient(os.environ.get('COMFYUI_URL', 'http://127.0.0.1:8188'))
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        store = TaskStore(root / 'state.sqlite3')
        workflow_id = os.environ.get('STUDIO_TEST_WORKFLOW', 'smoke')
        registry = SmokeRegistry() if workflow_id == 'smoke' else WorkflowRegistry(Path(__file__).resolve().parents[1] / 'workflows')
        service = QueueService(store, client, registry, root / 'outputs')
        try:
            await service.add({'workflow_id': workflow_id, 'prompts': ['A small orange cat beside a blue ceramic vase, morning light, detailed photograph'], 'seed': 0})
            for _ in range(int(os.environ.get('STUDIO_TEST_TIMEOUT', '120'))):
                await service.tick()
                task = service.tasks[0]
                if task['status'] == 'completed':
                    path = root / 'outputs' / task['filename']
                    assert path.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
                    if os.environ.get('STUDIO_TEST_SAVE'):
                        save_path = Path(os.environ['STUDIO_TEST_SAVE'])
                        save_path.parent.mkdir(parents=True, exist_ok=True)
                        save_path.write_bytes(path.read_bytes())
                    restored = QueueService(store, client, registry, root / 'outputs')
                    assert restored.tasks[0]['filename'] == task['filename']
                    print(f"PASS: {workflow_id} real ComfyUI -> PNG -> SQLite recovery ({path.stat().st_size} bytes, {task['elapsed']}s)")
                    return
                if task['status'] in ('failed', 'unknown'):
                    raise RuntimeError(task['error_msg'])
                await asyncio.sleep(1)
            raise TimeoutError('ComfyUI transport test timed out')
        finally:
            store.close()
            await client.close()


if __name__ == '__main__':
    asyncio.run(main())
