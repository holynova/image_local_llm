import httpx


class ComfyClient:
    def __init__(self, url):
        self.url = url.rstrip('/')
        self.http = httpx.AsyncClient(base_url=self.url, timeout=15, trust_env=False)

    async def get(self, path, **kwargs):
        response = await self.http.get(path, **kwargs)
        response.raise_for_status()
        return response.json()

    async def post(self, path, body):
        response = await self.http.post(path, json=body)
        if response.is_error:
            raise ValueError(f'ComfyUI {response.status_code}: {response.text[:1500]}')
        return response.json()

    async def submit(self, task, client_id):
        return await self.post('/prompt', {'prompt': task['graph'], 'client_id': client_id,
            'prompt_id': task['submission_id'], 'extra_data': {'studio_task_id': task['id']}})

    async def locate(self, task):
        """Recover a submission whose HTTP response was lost using stable extra_data."""
        history = await self.get('/history')
        queue = await self.get('/queue')
        for pid, entry in history.items():
            prompt = entry.get('prompt', [])
            if len(prompt) > 3 and prompt[3].get('studio_task_id') == task['id']:
                return pid
        for entry in queue.get('queue_running', []) + queue.get('queue_pending', []):
            if len(entry) > 3 and entry[3].get('studio_task_id') == task['id']:
                return entry[1]
        return None

    async def image(self, descriptor):
        response = await self.http.get('/view', params={key: descriptor.get(key, '')
            for key in ('filename', 'subfolder', 'type')})
        response.raise_for_status()
        content = response.content
        if not content.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('Workflow must output PNG images via SaveImage')
        return content

    async def close(self):
        await self.http.aclose()
