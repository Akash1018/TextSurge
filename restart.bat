@echo off
:loop
echo 🚀 Starting server...
node server.js
echo ❌ Server crashed! Restarting in 2 minutes...
timeout /t 120 /nobreak
goto loop