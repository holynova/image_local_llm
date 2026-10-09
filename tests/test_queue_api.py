import unittest
from unittest.mock import AsyncMock, patch
import httpx
from server import app
from backend.workflows import WorkflowRegistry
from pathlib import Path


class QueueAPITests(unittest.IsolatedAsyncioTestCase):
    async def test_switch_model_endpoint(self):
        fake = AsyncMock()
        fake.switch_model.return_value = {'updated': 3, 'active_unchanged': 1}
        with patch('server.service', return_value=fake):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
                response = await client.post('/api/queue/model', json={'workflow_id': 'sdxl-turbo'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['updated'], 3)
        fake.switch_model.assert_awaited_once_with('sdxl-turbo')

    async def test_images_per_prompt_validation(self):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
            for count in (0, 101, 1.5, True):
                response = await client.post('/api/queue/add', json={'prompts': ['a'], 'images_per_prompt': count})
                self.assertEqual(response.status_code, 422)
            response = await client.post('/api/queue/add', json={'prompts': ['a'] * 11, 'images_per_prompt': 100})
            self.assertEqual(response.status_code, 422)

    async def test_shuffle_endpoint(self):
        fake = AsyncMock()
        fake.mutate.return_value = 5
        with patch('server.service', return_value=fake):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
                response = await client.post('/api/queue/shuffle')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['shuffled'], 5)
        fake.mutate.assert_awaited_once_with('shuffle')

    async def test_150_chinese_prompts_accepted(self):
        prompts = [f'将《龙珠》中的“Z战士集结迎战魔人布欧”绘制为黑白漫画扉页。测试 {i}' for i in range(150)]
        fake = AsyncMock()
        fake.add.return_value = [{'id': str(i)} for i in range(150)]
        with patch('server.service', return_value=fake):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
                response = await client.post('/api/queue/add', json={'prompts': prompts, 'workflow_id': 'z-image-turbo'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()['added']), 150)

    async def test_batch_limit_is_explicit(self):
        # No lifespan needed: the validation rejects the request before service access.
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
            response = await client.post('/api/queue/add', json={'prompts': ['test'] * 1001})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()['detail'][0]['loc'], ['body', 'prompts'])
        self.assertEqual(response.json()['detail'][0]['ctx']['max_length'], 1000)

    def test_two_model_templates_bind_parameters(self):
        registry = WorkflowRegistry(Path(__file__).resolve().parents[1] / 'workflows')
        for model in ('z-image-turbo', 'sdxl-turbo'):
            params = {**registry.by_id[model]['defaults'], 'prompt': 'hello', 'seed': 0}
            graph = registry.build(model, params)
            self.assertEqual(graph['6']['inputs']['text'], 'hello')
            self.assertEqual(graph['3']['inputs']['seed'], 0)
        self.assertEqual(registry.by_id['sdxl-turbo']['defaults']['steps'], 4)

    def test_qwen_profile_is_memory_conservative(self):
        registry = WorkflowRegistry(Path(__file__).resolve().parents[1] / 'workflows')
        entry = registry.by_id['qwen-image-2.1-int8']
        graph = registry.build(entry['id'], {**entry['defaults'], 'prompt': '中文海报', 'seed': 0})
        self.assertEqual(graph['6']['inputs']['prompt'], '中文海报')
        self.assertEqual(graph['2']['inputs']['device'], 'cpu')
        self.assertEqual(graph['10']['inputs']['dtype'], 'int8')
        self.assertEqual(graph['5']['inputs']['width'], 768)
        self.assertEqual(graph['3']['inputs']['cfg'], 1)

    def test_flux2_profile_and_shared_dimension_bindings(self):
        registry = WorkflowRegistry(Path(__file__).resolve().parents[1] / 'workflows')
        entry = registry.by_id['flux2-klein-4b-fp8']
        graph = registry.build(entry['id'], {**entry['defaults'], 'width': 1280, 'height': 720, 'prompt': 'cat', 'seed': 7})
        self.assertEqual(graph['5']['inputs']['width'], 1280)
        self.assertEqual(graph['12']['inputs']['width'], 1280)
        self.assertEqual(graph['12']['inputs']['height'], 720)
        self.assertEqual(graph['12']['inputs']['steps'], 4)
        self.assertEqual(graph['10']['inputs']['noise_seed'], 7)
        self.assertEqual(graph['2']['inputs']['type'], 'flux2')
        self.assertEqual(graph['2']['inputs']['device'], 'cpu')
