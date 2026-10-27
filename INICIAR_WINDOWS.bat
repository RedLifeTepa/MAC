@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instala Node.js 22 LTS desde https://nodejs.org y vuelve a abrir este archivo.
 pause
 exit /b 1
)
start "MAC Store - Conectado" cmd /k node scripts\serve.js
timeout /t 2 /nobreak >nul
start "" http://localhost:8080
