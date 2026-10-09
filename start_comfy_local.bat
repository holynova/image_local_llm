@echo off
setlocal
cd /d "%~dp0"
if not defined COMFYUI_HOME set COMFYUI_HOME=G:\code\ComfyUI_windows_portable
if not exist "%COMFYUI_HOME%\python_embeded\python.exe" (
    echo Set COMFYUI_HOME to the ComfyUI Portable directory.
    pause
    exit /b 1
)
"%COMFYUI_HOME%\python_embeded\python.exe" -s "%COMFYUI_HOME%\ComfyUI\main.py" --windows-standalone-build --listen 127.0.0.1 --port 8189 --extra-model-paths-config "%~dp0comfy-model-paths.yaml" --disable-all-custom-nodes
pause
