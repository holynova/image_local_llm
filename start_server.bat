@echo off
title Z-Image-Turbo Studio Server
echo ===================================================
echo   Z-Image-Turbo Studio - Server Starter
echo ===================================================
echo.

if not exist venv (
    echo [ERROR] Virtual environment 'venv' not found.
    echo Please run 'install.bat' first to install the system dependencies.
    pause
    exit /b 1
)

echo Activating environment and running FastAPI server...
call venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000

pause
