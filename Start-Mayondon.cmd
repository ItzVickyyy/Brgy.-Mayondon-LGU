@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-mayondon.ps1"
if errorlevel 1 (
  echo.
  echo The program could not be started. Open Docker Desktop, wait until it says it is running, and double-click this file again.
) else (
  echo.
  echo Started. Double-click Check-Mayondon.cmd to see that everything is fine.
)
echo.
pause
