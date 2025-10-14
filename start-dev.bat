@echo off
echo Starting Final10 Development Environment...
echo.

echo Starting Backend Server...
start "Backend Server" cmd /k "cd /d c:\Users\ericv\final10\server && npm start"

timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d c:\Users\ericv\final10\client && npm start"

echo.
echo Both servers are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause > nul


