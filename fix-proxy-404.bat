@echo off
echo ========================================
echo   FIXING PROXY 404 ERROR
echo ========================================
echo.
echo The issue: Frontend proxy not loading setupProxy.js
echo The fix: Complete server restart with proper order
echo.

echo Step 1: Stopping ALL Node.js processes...
taskkill /f /im node.exe 2>nul
echo ✅ All Node.js processes stopped
echo.

echo Step 2: Waiting 3 seconds for cleanup...
timeout /t 3 /nobreak >nul
echo.

echo Step 3: Starting Backend Server...
echo Please open a NEW terminal window and run:
echo.
echo   cd c:\Users\ericv\final10\server
echo   npm start
echo.
echo ⏳ Wait for: "Server running on port 5000"
echo.

echo Step 4: Starting Frontend Server...
echo Then open ANOTHER new terminal window and run:
echo.
echo   cd c:\Users\ericv\final10\client
echo   npm start
echo.
echo ⏳ Wait for: "🔧 Loading setupProxy.js..." in the console
echo ⏳ Then wait for: "Local: http://localhost:3000"
echo.

echo Step 5: Test the Fix...
echo Once both servers show the messages above:
echo 1. Go to http://localhost:3000
echo 2. Try to login with demo@final10.com / demo123
echo 3. Should work without 404 errors!
echo.

echo ========================================
echo   CRITICAL: Use SEPARATE terminals!
echo ========================================
echo Terminal 1: Backend (port 5000)
echo Terminal 2: Frontend (port 3000)
echo.
echo Look for these console messages:
echo ✅ Backend: "Server running on port 5000"
echo ✅ Frontend: "🔧 Loading setupProxy.js..."
echo ✅ Frontend: "✅ Proxy middleware configured successfully"
echo ========================================
echo.
pause
