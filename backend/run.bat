@echo off
cd /d "%~dp0src"
if "%PORT%"=="" set PORT=8000
if "%WORKERS%"=="" set WORKERS=3
..\.venv\Scripts\python.exe -m uvicorn studportrait.asgi:application --host 0.0.0.0 --port %PORT% --workers %WORKERS%
