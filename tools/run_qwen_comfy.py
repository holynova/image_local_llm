"""Use an isolated ComfyUI core/dependency overlay with the existing CUDA runtime."""
import os
from pathlib import Path
import runpy
import sys

core = Path(os.environ.get('QWEN_COMFY_HOME', r'G:\code\ComfyUI_qwen21'))
sys.path.insert(0, str(core / 'runtime_deps'))
sys.path.insert(0, str(core))
os.chdir(core)
sys.argv = [str(core / 'main.py'), *sys.argv[1:]]
runpy.run_path(str(core / 'main.py'), run_name='__main__')
