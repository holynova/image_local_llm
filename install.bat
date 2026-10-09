@echo off
setlocal
cd /d "%~dp0"
echo Installing the lightweight ComfyUI client environment...
if not exist .venv-comfy\Scripts\python.exe (
    python -m venv .venv-comfy
    if errorlevel 1 exit /b 1
)
call .venv-comfy\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 exit /b 1
echo Ready. Start ComfyUI separately, then run start_server.bat.
pause
