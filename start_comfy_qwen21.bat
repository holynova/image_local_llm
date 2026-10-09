@echo off
setlocal
cd /d "%~dp0"
if not defined COMFYUI_HOME set COMFYUI_HOME=G:\code\ComfyUI_windows_portable
"%COMFYUI_HOME%\python_embeded\python.exe" -s tools\run_qwen_comfy.py --listen 127.0.0.1 --port 8190 --extra-model-paths-config "%~dp0comfy-model-paths.yaml" --disable-all-custom-nodes --lowvram --reserve-vram 2 --cpu-vae --disable-pinned-memory
pause
