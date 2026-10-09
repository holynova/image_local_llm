import tempfile
import unittest
from pathlib import Path

from backend.queue_service import QueueService
from backend.task_store import TaskStore
from backend.workflows import WorkflowRegistry

ROOT = Path(__file__).resolve().parents[1]


class FakeComfy:
    url = 'http://localhost:8188'

    def __init__(self):
        self.submissions = 0
        self.history = {}
        self.queue = {'queue_running': [], 'queue_pending': []}
        self.lose_response = False
        self.remote_task = None
        self.posts = []

    async def get(self, path):
        if path == '/object_info':
            registry = WorkflowRegistry(ROOT / 'workflows')
            graph = registry.build('z-image-turbo', {'prompt': '', 'seed': 0, **registry.entries[0]['defaults']})
            return {n['class_type']: {'input': {}} for n in graph.values()}
        if path == '/queue':
            return self.queue
        if path == '/history':
            return self.history
        if path.startswith('/history/'):
            pid = path.split('/')[-1]
            return {pid: self.history[pid]} if pid in self.history else {}
        raise AssertionError(path)

    async def submit(self, task, client_id):
        self.submissions += 1
        self.remote_task = task['submission_id']
        self.queue['queue_running'] = [[0, self.remote_task]]
        if self.lose_response:
            raise TimeoutError('response lost')
        return {'prompt_id': self.remote_task}

    async def locate(self, task):
        return self.remote_task

    async def image(self, descriptor):
        return b'\x89PNG\r\n\x1a\nmock-image'

    async def post(self, path, body):
        self.posts.append((path, body))
        return {}


class IntegrationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name)
        self.store = TaskStore(self.path / 'tasks.sqlite3')
        self.client = FakeComfy()
        self.registry = WorkflowRegistry(ROOT / 'workflows')
        self.service = QueueService(self.store, self.client, self.registry, self.path / 'outputs')

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    async def add(self):
        return await self.service.add({'workflow_id': 'z-image-turbo', 'prompts': ['hello'],
            'seed': 0, 'width': 512, 'height': 512, 'steps': None, 'guidance_scale': None})

    async def test_seed_defaults_and_snapshot(self):
        await self.add()
        task = self.service.tasks[0]
        self.assertEqual(task['seed_used'], 0)
        self.assertEqual(task['graph']['3']['inputs']['cfg'], 1)
        self.assertEqual(task['graph']['5']['inputs']['width'], 512)
        restored = QueueService(self.store, self.client, self.registry, self.path / 'outputs')
        self.assertEqual(restored.status, 'paused')
        self.assertEqual(restored.tasks[0]['graph'], task['graph'])

    async def test_multiple_images_per_prompt_have_independent_tasks(self):
        added = await self.service.add({'workflow_id': 'z-image-turbo', 'prompts': ['first', 'second'],
                                        'seed': 10, 'images_per_prompt': 3})
        self.assertEqual([t['prompt'] for t in added], ['first'] * 3 + ['second'] * 3)
        self.assertEqual([t['seed_used'] for t in added], [10, 11, 12] * 2)
        self.assertEqual(len({t['id'] for t in added}), 6)
        self.assertEqual(len(self.store.load()['tasks']), 6)

    async def test_variations_total_limit_is_atomic(self):
        with self.assertRaises(ValueError):
            await self.service.add({'workflow_id': 'z-image-turbo', 'prompts': ['a'] * 11,
                                    'seed': -1, 'images_per_prompt': 100})
        self.assertEqual(self.service.tasks, [])

    async def test_switch_model_updates_pending_but_not_active_or_completed(self):
        from unittest.mock import AsyncMock
        await self.add()
        await self.service.tick()
        active = dict(self.service.tasks[0])
        await self.add()
        waiting = self.service.tasks[1]
        original_seed, original_id = waiting['seed_used'], waiting['id']
        completed = {**active, 'id': 'done', 'status': 'completed'}
        self.service.tasks.append(completed)
        graph = self.registry.build('sdxl-turbo', {**self.registry.by_id['sdxl-turbo']['defaults'], 'prompt': '', 'seed': 0})
        self.client.get = AsyncMock(return_value={n['class_type']: {'input': {}} for n in graph.values()})
        result = await self.service.switch_model('sdxl-turbo')
        self.assertEqual(result, {'updated': 1, 'active_unchanged': 1})
        self.assertEqual(self.service.tasks[0], active)
        self.assertEqual(completed['workflow_id'], 'z-image-turbo')
        self.assertEqual(waiting['workflow_id'], 'sdxl-turbo')
        self.assertEqual(waiting['steps'], 4)
        self.assertEqual(waiting['width'], 512)
        self.assertEqual(waiting['seed_used'], original_seed)
        self.assertEqual(waiting['id'], original_id)
        self.assertEqual(waiting['graph']['3']['inputs']['seed'], original_seed)
        self.assertEqual(self.store.load()['tasks'][1]['workflow_id'], 'sdxl-turbo')

    async def test_unavailable_switch_is_atomic(self):
        from unittest.mock import AsyncMock
        import copy
        await self.add()
        before = copy.deepcopy(self.service.tasks)
        self.client.get = AsyncMock(return_value={})
        with self.assertRaises(ValueError):
            await self.service.switch_model('sdxl-turbo')
        self.assertEqual(self.service.tasks, before)

    async def test_150_tasks_persist_without_execution(self):
        added = await self.service.add({'workflow_id': 'z-image-turbo',
            'prompts': [f'中文批量提示词 {i}' for i in range(150)], 'seed': -1})
        self.assertEqual(len(added), 150)
        self.assertEqual(len(self.store.load()['tasks']), 150)
        self.assertEqual(self.client.submissions, 0)

    async def test_lost_response_never_resubmits(self):
        await self.add()
        self.client.lose_response = True
        await self.service.tick()
        await self.service.tick()
        self.assertEqual(self.client.submissions, 1)
        self.assertEqual(self.service.tasks[0]['status'], 'generating')

    async def test_missing_remote_task_blocks_retry(self):
        await self.add()
        await self.service.tick()
        self.client.queue['queue_running'] = []
        await self.service.tick()
        self.assertEqual(self.service.tasks[0]['status'], 'unknown')
        with self.assertRaises(ValueError):
            await self.service.resume()
        self.assertEqual(self.client.submissions, 1)

    async def test_pause_and_completion_persist_gallery(self):
        await self.add()
        await self.service.tick()
        await self.service.pause()
        pid = self.service.tasks[0]['prompt_id']
        self.client.history[pid] = {'status': {'status_str': 'success'},
            'outputs': {'9': {'images': [{'filename': 'remote.png'}]}}}
        await self.service.tick()
        task = self.service.tasks[0]
        self.assertEqual(task['status'], 'completed')
        self.assertTrue((self.path / 'outputs' / task['filename']).exists())
        await self.service.mutate('clear-completed')
        self.assertFalse(task['visible'])
        self.assertEqual(task['status'], 'completed')

    async def test_shared_instance_stop_only_pauses(self):
        await self.add()
        await self.service.tick()
        with self.assertRaises(ValueError):
            await self.service.stop()
        self.assertEqual(self.service.status, 'paused')
        self.assertEqual(self.client.posts, [])

    async def test_clear_preserves_active_task_and_gallery(self):
        await self.add()
        await self.service.tick()
        active = self.service.tasks[0]
        await self.add()
        completed = {**active, 'id': 'completed', 'status': 'completed', 'filename': 'saved.png'}
        self.service.tasks.append(completed)
        output = self.path / 'outputs' / 'saved.png'
        output.parent.mkdir(exist_ok=True)
        output.write_bytes(b'image')
        await self.service.mutate('clear')
        self.assertEqual(self.service.tasks, [active, completed])
        self.assertEqual(active['status'], 'generating')
        self.assertFalse(completed['visible'])
        self.assertEqual(output.read_bytes(), b'image')
        self.assertEqual(self.client.posts, [])
        self.assertEqual(len(self.store.load()['tasks']), 2)

    async def test_shuffle_only_reorders_pending_and_persists(self):
        from unittest.mock import patch
        await self.add()
        await self.service.tick()
        active = self.service.tasks[0]
        for _ in range(4):
            await self.add()
        before = [t['id'] for t in self.service.tasks]
        self.service.tasks[2]['status'] = 'failed'
        with patch('backend.queue_service.secrets.SystemRandom.shuffle', side_effect=lambda items: items.reverse()):
            count = await self.service.mutate('shuffle')
        after = [t['id'] for t in self.service.tasks]
        self.assertEqual(count, 3)
        self.assertIs(self.service.tasks[0], active)
        self.assertEqual(after[2], before[2])
        self.assertEqual(set(after), set(before))
        self.assertNotEqual(after, before)
        self.assertEqual([t['id'] for t in self.store.load()['tasks']], after)
        self.assertEqual(self.client.posts, [])

    async def test_recovery_tracks_existing_remote_task(self):
        await self.add()
        await self.service.tick()
        recovered = QueueService(self.store, self.client, self.registry, self.path / 'outputs')
        await recovered.tick()
        self.assertEqual(self.client.submissions, 1)
        self.assertEqual(recovered.tasks[0]['status'], 'generating')
        self.assertEqual(recovered.status, 'paused')

    async def test_dedicated_stop_targets_owned_prompt(self):
        await self.add()
        await self.service.tick()
        self.service.dedicated = True
        await self.service.stop()
        pid = self.service.tasks[0]['prompt_id']
        self.assertEqual(self.client.posts, [('/interrupt', {'prompt_id': pid})])
        self.client.history[pid] = {'status': {'status_str': 'error', 'messages': ['interrupted']}}
        await self.service.tick()
        self.assertEqual(self.service.tasks[0]['status'], 'skipped')

    async def test_reordering_does_not_replace_active_task(self):
        await self.add()
        await self.service.tick()
        await self.add()
        pending = self.service.tasks[1]['id']
        await self.service.mutate('move-front', pending)
        await self.service.tick()
        self.assertEqual(self.client.submissions, 1)
        self.assertEqual(self.service.tasks[0]['status'], 'pending')

    async def test_workflow_snapshot_unchanged_by_new_defaults(self):
        await self.add()
        self.registry.entries[0]['defaults']['steps'] = 20
        self.assertEqual(self.service.tasks[0]['graph']['3']['inputs']['steps'], 9)

    async def test_completion_race_does_not_mark_unknown(self):
        await self.add()
        await self.service.tick()
        pid = self.service.tasks[0]['prompt_id']
        original = self.client.get
        calls = 0
        async def get(path):
            nonlocal calls
            if path == '/history/' + pid:
                calls += 1
                if calls > 1:
                    return {pid: {'status': {'status_str': 'success'}}}
            return await original(path)
        self.client.get = get
        self.client.queue['queue_running'] = []
        await self.service.tick()
        self.assertEqual(self.service.tasks[0]['status'], 'generating')

    def test_missing_model_reported(self):
        graph = {'1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'missing'}}}
        info = {'UNETLoader': {'input': {'required': {'unet_name': [['installed']]}}}}
        self.assertIn('missing', self.registry.problems(graph, info)[0])


if __name__ == '__main__':
    unittest.main()
