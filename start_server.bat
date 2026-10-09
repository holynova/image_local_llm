@echo off
title Z-Image-Turbo Studio Server
echo ===================================================
echo   Z-Image-Turbo Studio - Server Starter
echo ===================================================
echo.

cd /d "%~dp0"
if not exist .venv-comfy\Scripts\python.exe (
    echo [ERROR] Client environment '.venv-comfy' not found.
    echo Please run 'install.bat' first to install the system dependencies.
    pause
    exit /b 1
)

echo Activating environment and running FastAPI server...
if not defined COMFYUI_URL set COMFYUI_URL=http://127.0.0.1:8188
call .venv-comfy\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000

pause
