@echo off
title Football Overlay Server
cd /d "%~dp0"
where node >nul 2>nul || (echo Chua cai Node.js. Tai tai https://nodejs.org & pause & exit /b)
start "" /min cmd /c "timeout /t 2 >nul & start http://localhost:3000/control.html"
node server.js
pause
