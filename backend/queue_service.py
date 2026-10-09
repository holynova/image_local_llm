import asyncio
import json
import secrets
import time
import uuid
from urllib.parse import urlsplit, urlunsplit

import httpx
import websockets


class QueueService:
    def __init__(self, store, client, registry, outputs, dedicated=False):
        self.store, self.client, self.registry, self.outputs = store, client, registry, outputs
        state = store.load()
        self.tasks = state['tasks']
        # A restart never auto-starts new work. Existing remote work is reconciled.
        self.status = 'paused' if any(t['status'] in ('pending', 'generating', 'submitting', 'unknown')
                                     for t in self.tasks) else 'idle'
        self.dedicated = dedicated
        self.lock = asyncio.Lock()
        self.client_id = str(uuid.uuid4())
        self.error = ''
        self.progress = {}
        self.outputs.mkdir(parents=True, exist_ok=True)

    def save(self):
        self.store.save(self.tasks, self.status)

    def public(self, task):
        return {k: v for k, v in task.items() if k not in ('graph', 'output_nodes')}

    async def add(self, params):
        count = params.get('images_per_prompt', 1)
        if not isinstance(count, int) or isinstance(count, bool) or not 1 <= count <= 100:
            raise ValueError('Images per prompt must be an integer from 1 to 100')
        if len(params['prompts']) * count > 1000:
            raise ValueError('Maximum 1000 images per batch')
        workflow_id = params['workflow_id']
        if workflow_id not in self.registry.by_id:
            raise ValueError('Unknown generation workflow')
        defaults = self.registry.by_id[workflow_id]['defaults']
        config = {**defaults, **{k: v for k, v in params.items() if v is not None}}
        info = await self.client.get('/object_info')
        graph = self.registry.build(workflow_id, {**config, 'prompt': '', 'seed': 0})
        problems = self.registry.problems(graph, info)
        if problems:
            raise ValueError('; '.join(problems))
        async with self.lock:
            added = []
            for prompt, variation in ((p, i) for p in params['prompts'] for i in range(count)):
                seed = (config['seed'] + variation) % (2**53) if config['seed'] >= 0 else secrets.randbelow(2**53)
                item = {'id': 'task_' + uuid.uuid4().hex, 'prompt': prompt.strip(),
                    'workflow_id': workflow_id, 'width': config['width'], 'height': config['height'],
                    'steps': config['steps'], 'guidance_scale': config['guidance_scale'],
                    'seed': config['seed'], 'seed_used': seed, 'status': 'pending',
                    'elapsed': 0, 'filename': '', 'filenames': [], 'error_msg': '',
                    'prompt_id': None, 'submission_id': str(uuid.uuid4()), 'created_at': time.time(),
                    'graph': self.registry.build(workflow_id, {**config, 'prompt': prompt.strip(), 'seed': seed}),
                    'output_nodes': self.registry.by_id[workflow_id]['output_nodes'],
                    'visible': True}
                added.append(item)
            if params.get('front'):
                self.tasks[0:0] = added
            else:
                self.tasks.extend(added)
            if self.status == 'idle':
                self.status = 'running'
            self.save()
            return [self.public(t) for t in added]

    async def switch_model(self, workflow_id):
        if workflow_id not in self.registry.by_id:
            raise ValueError('Unknown generation workflow')
        entry = self.registry.by_id[workflow_id]
        async with self.lock:
            # Validate before changing any task; worker dispatch uses this same lock.
            info = await self.client.get('/object_info')
            probe = self.registry.build(workflow_id, {**entry['defaults'], 'prompt': '', 'seed': 0})
            problems = self.registry.problems(probe, info)
            if problems:
                raise ValueError('; '.join(problems))
            replacements = []
            for task in self.tasks:
                if task['status'] != 'pending' or task['workflow_id'] == workflow_id:
                    continue
                params = {**entry['defaults'], 'prompt': task['prompt'], 'seed': task['seed_used']}
                replacements.append((task, {
                    'workflow_id': workflow_id, 'workflow_label': entry['label'],
                    **{key: params[key] for key in ('width', 'height', 'steps', 'guidance_scale')},
                    'graph': self.registry.build(workflow_id, params),
                    'output_nodes': entry['output_nodes'], 'error_msg': '',
                }))
            for task, replacement in replacements:
                task.update(replacement)
            self.save()
            return {'updated': len(replacements), 'active_unchanged': sum(
                t['status'] in ('generating', 'submitting', 'unknown') for t in self.tasks)}

    async def tick(self):
        async with self.lock:
            active = next((t for t in self.tasks if t['status'] in ('generating', 'submitting')), None)
            if active:
                await self.reconcile(active)
                return
            if self.status != 'running':
                return
            task = next((t for t in self.tasks if t['status'] == 'pending'), None)
            if not task:
                self.status = 'idle'
                self.save()
                return
            # Recheck availability when dispatching a restored/future task.
            info = await self.client.get('/object_info')
            problems = self.registry.problems(task['graph'], info)
            if problems:
                task['status'] = 'failed'
                task['error_msg'] = '; '.join(problems)
                self.save()
                return
            task['status'] = 'submitting'
            task['started_at'] = time.time()
            self.save()  # Write intent before side effect.
            try:
                result = await self.client.submit(task, self.client_id)
                task['prompt_id'] = result['prompt_id']
                task['status'] = 'generating'
                task['error_msg'] = ''
            except ValueError as exc:
                task['status'] = 'failed'
                task['error_msg'] = str(exc)
            except Exception as exc:
                # Keep submitting; a successful remote request may have lost its response.
                self.status = 'paused'
                task['error_msg'] = f'Submission response lost; checking remote task: {exc}'
            self.save()

    async def reconcile(self, task):
        if not task['prompt_id']:
            task['prompt_id'] = await self.client.locate(task)
            if not task['prompt_id']:
                task['status'] = 'unknown'
                task['error_msg'] = 'Cannot confirm remote submission. Not resubmitted; inspect ComfyUI history before retrying.'
                self.status = 'paused'
                self.save()
                return
            task['status'] = 'generating'
            self.save()
        pid = task['prompt_id']
        history = await self.client.get('/history/' + pid)
        task['elapsed'] = round(time.time() - task.get('started_at', time.time()), 2)
        if pid in history:
            entry = history[pid]
            status = entry.get('status', {})
            if status.get('status_str') == 'error':
                task['status'] = 'skipped' if task.get('cancel_requested') else 'failed'
                task['error_msg'] = json.dumps(status.get('messages', []), ensure_ascii=False)[-1500:]
            else:
                descriptors = [image for node in task['output_nodes']
                    for image in entry.get('outputs', {}).get(node, {}).get('images', [])]
                if not descriptors:
                    task['status'] = 'failed'
                    task['error_msg'] = 'Workflow finished without configured PNG output'
                else:
                    files = []
                    for index, descriptor in enumerate(descriptors):
                        filename = f"{task['id']}_{index}.png"
                        # Stable names make recovery after interruption idempotent.
                        content = await self.client.image(descriptor)
                        temp = self.outputs / (filename + '.part')
                        await asyncio.to_thread(temp.write_bytes, content)
                        temp.replace(self.outputs / filename)
                        files.append(filename)
                    task.update(status='completed', filename=files[0], filenames=files, error_msg='')
            self.progress.pop(pid, None)
            self.save()
            return
        queue = await self.client.get('/queue')
        present = any(row[1] == pid for row in queue.get('queue_running', []) + queue.get('queue_pending', []))
        if not present:
            # Second history check closes the completion-between-two-requests race.
            check = await self.client.get('/history/' + pid)
            if pid in check:
                return
            task['status'] = 'skipped' if task.get('cancel_requested') else 'unknown'
            task['error_msg'] = 'Remote task is absent from queue and history; no automatic resubmission.'
            self.status = 'paused'
            self.save()

    async def run(self):
        while True:
            try:
                await self.tick()
                self.error = ''
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.error = f'ComfyUI connection/reconciliation: {exc}'
            await asyncio.sleep(1)

    async def listen(self):
        parsed = urlsplit(self.client.url)
        ws_url = urlunsplit(('wss' if parsed.scheme == 'https' else 'ws', parsed.netloc,
                             parsed.path + '/ws', 'clientId=' + self.client_id, ''))
        while True:
            try:
                async with websockets.connect(ws_url, max_size=4 * 1024 * 1024) as ws:
                    async for message in ws:
                        if not isinstance(message, str):
                            continue
                        event = json.loads(message)
                        data = event.get('data', {})
                        if event.get('type') == 'progress' and data.get('prompt_id'):
                            self.progress[data['prompt_id']] = data
            except asyncio.CancelledError:
                raise
            except Exception:
                await asyncio.sleep(3)  # History polling remains authoritative.

    async def pause(self):
        async with self.lock:
            self.status = 'paused'
            self.save()

    async def resume(self):
        async with self.lock:
            if any(t['status'] == 'unknown' for t in self.tasks):
                raise ValueError('Resolve unknown tasks by inspecting ComfyUI and skipping/deleting them first')
            self.status = 'running'
            self.save()

    async def stop(self):
        async with self.lock:
            self.status = 'paused'
            self.save()
            active = next((t for t in self.tasks if t['status'] in ('generating', 'submitting')), None)
            if not active:
                return
            if not self.dedicated:
                raise ValueError('Immediate stop requires COMFYUI_DEDICATED=1 for a dedicated instance. Queue is paused.')
            if not active['prompt_id']:
                active['prompt_id'] = await self.client.locate(active)
            if not active['prompt_id']:
                raise ValueError('Submission is unresolved; cannot interrupt safely')
            queue = await self.client.get('/queue')
            pid = active['prompt_id']
            if any(t[1] == pid for t in queue.get('queue_pending', [])):
                await self.client.post('/queue', {'delete': [pid]})
            elif any(t[1] == pid for t in queue.get('queue_running', [])):
                await self.client.post('/interrupt', {'prompt_id': pid})
            active['cancel_requested'] = True
            self.save()

    async def mutate(self, action, task_id=None):
        async with self.lock:
            if action == 'clear':
                # Keep completed records for the gallery, and never lose tracking
                # of a submitted (or unresolved) remote generation.
                for task in self.tasks:
                    if task['status'] == 'completed':
                        task['visible'] = False
                self.tasks = [t for t in self.tasks if t['status'] in
                              ('completed', 'generating', 'submitting', 'unknown')]
                if not any(t['status'] in ('generating', 'submitting', 'unknown') for t in self.tasks):
                    self.status = 'idle'
            elif action == 'shuffle':
                positions = [i for i, t in enumerate(self.tasks) if t['status'] == 'pending']
                waiting = [self.tasks[i] for i in positions]
                secrets.SystemRandom().shuffle(waiting)
                for i, task in zip(positions, waiting):
                    self.tasks[i] = task
                self.save()
                return len(waiting)
            elif action == 'clear-completed':
                for task in self.tasks:
                    if task['status'] in ('completed', 'failed', 'skipped'):
                        task['visible'] = False
            else:
                task = next((t for t in self.tasks if t['id'] == task_id), None)
                if not task:
                    raise ValueError('Task not found')
                if task['status'] in ('generating', 'submitting'):
                    raise ValueError('Active tasks cannot be edited')
                if action == 'delete':
                    task['visible'] = False
                    if task['status'] != 'completed':
                        self.tasks.remove(task)
                elif action == 'skip':
                    if task['status'] == 'completed':
                        raise ValueError('Completed tasks cannot be skipped')
                    task['status'] = 'skipped'
                elif action == 'move-front':
                    if task['status'] != 'pending':
                        raise ValueError('Only pending tasks can be reordered')
                    self.tasks.remove(task)
                    self.tasks.insert(0, task)
            self.save()
