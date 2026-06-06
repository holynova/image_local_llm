@echo off
setlocal enabledelayedexpansion
title Z-Image-Turbo One-Click Installer

echo ===================================================
echo   Z-Image-Turbo Studio - One-Click Installer
echo ===================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python was not found in your system PATH.
    echo Please download and install Python 3.10 or 3.11 from python.org.
    echo Make sure to check the "Add Python to PATH" option during installation.
    pause
    exit /b 1
)

:: 2. Create Venv
if not exist venv (
    echo [1/5] Creating Python virtual environment (venv)...
    python -m venv venv
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
) else (
    echo [1/5] Virtual environment (venv) already exists.
)

:: 3. Upgrade pip
echo [2/5] Upgrading pip...
call venv\Scripts\python.exe -m pip install --upgrade pip

:: 4. Install CUDA-enabled PyTorch
echo [3/5] Installing CUDA 12.8 compatible PyTorch...
echo This download is large (around 2-3GB) and may take several minutes. Please wait...
call venv\Scripts\pip.exe install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
if !errorlevel! neq 0 (
    echo [ERROR] Failed to install PyTorch. Please check your network connection and try again.
    pause
    exit /b 1
)

:: 5. Install Diffusers & Dependencies
echo [4/5] Installing diffusers and core dependencies...
:: Check if git is installed
where git >nul 2>&1
if %errorlevel% equ 0 (
    echo Git found. Installing diffusers from source github main branch...
    call venv\Scripts\pip.exe install git+https://github.com/huggingface/diffusers
) else (
    echo [Warning] Git is not installed or not in PATH.
    echo Installing stable diffusers release from PyPI...
    call venv\Scripts\pip.exe install diffusers
)

echo Installing other dependencies (transformers, accelerate, web stack)...
call venv\Scripts\pip.exe install transformers accelerate sentencepiece protobuf peft fastapi uvicorn requests
if !errorlevel! neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

:: 6. Apply Patches
echo [5/5] Applying local compatibility patches to dependencies...
call venv\Scripts\python.exe apply_patches.py
if !errorlevel! neq 0 (
    echo [ERROR] Failed to apply environment patches.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   Installation Completed Successfully!
echo ===================================================
echo.
echo To run the studio server, you can use start_server.bat
echo or run the command: venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000
echo.

set /p choice="Would you like to start the Z-Image-Turbo server now? (y/n): "
if /i "!choice!"=="y" (
    echo Starting server...
    call venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000
)

pause
