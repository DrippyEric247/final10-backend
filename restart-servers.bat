@echo off
echo Restarting Final10 Development Servers...
echo.

echo Stopping existing servers...
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak > nul

echo Starting Backend Server...
start "Backend Server" cmd /k "cd /d c:\Users\ericv\final10\server && npm start"

timeout /t 5 /nobreak > nul

echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d c:\Users\ericv\final10\client && npm start"

echo.
echo Both servers are restarting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo The proxy configuration should now be active.
echo Press any key to exit...
pause > nul

