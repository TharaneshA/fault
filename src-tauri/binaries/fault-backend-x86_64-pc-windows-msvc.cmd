@echo off
REM Fault.ai Backend Sidecar Runner for Windows
REM This script starts the Python backend server for the Fault.ai application

cd /d "%~dp0..\..\backend"
python run_server.py
