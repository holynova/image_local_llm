import copy
import json
from pathlib import Path


class WorkflowRegistry:
    def __init__(self, directory: Path):
        self.directory = directory.resolve()
        self.entries = json.loads((directory / 'registry.json').read_text(encoding='utf-8'))
        self.by_id = {item['id']: item for item in self.entries}
        if len(self.by_id) != len(self.entries):
            raise ValueError('Duplicate workflow IDs')
        for item in self.entries:
            self.build(item['id'], {**item['defaults'], 'prompt': '', 'seed': 0})

    def build(self, workflow_id, parameters):
        item = self.by_id[workflow_id]
        path = (self.directory / item['workflow']).resolve()
        if not path.is_relative_to(self.directory):
            raise ValueError('Workflow path must stay inside workflows directory')
        graph = json.loads(path.read_text(encoding='utf-8'))
        if not graph or 'nodes' in graph:
            raise ValueError('Export ComfyUI workflow in API format, not editor format')
        for parameter, binding in item['bindings'].items():
            for target in binding if isinstance(binding, list) else [binding]:
                node, field = target.split('.', 1)
                if field not in graph[node]['inputs']:
                    raise ValueError(f'Invalid binding: {target}')
                graph[node]['inputs'][field] = parameters[parameter]
        return copy.deepcopy(graph)

    @staticmethod
    def problems(graph, object_info):
        problems = []
        for node in graph.values():
            kind = node['class_type']
            if kind not in object_info:
                problems.append(f'Missing ComfyUI node: {kind}')
                continue
            inputs = object_info[kind].get('input', {})
            specs = {**inputs.get('required', {}), **inputs.get('optional', {})}
            for key, value in node['inputs'].items():
                spec = specs.get(key)
                # Recent ComfyUI V3 nodes describe enums as COMBO + options.
                if spec and spec[0] == 'COMBO' and len(spec) > 1 and isinstance(spec[1], dict):
                    options = spec[1].get('options')
                    if options and not isinstance(value, list) and value not in options:
                        problems.append(f'{kind}.{key}: unavailable value {value}')
                if spec and isinstance(spec[0], list) and not isinstance(value, list):
                    if value not in spec[0]:
                        problems.append(f'{kind}.{key}: unavailable value/model {value}')
        return list(dict.fromkeys(problems))
