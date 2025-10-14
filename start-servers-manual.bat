@echo off
echo ========================================
echo   MANUAL SERVER STARTUP
echo ========================================
echo.
echo The 404 error means the proxy isn't working.
echo You need to start BOTH servers in SEPARATE terminals.
echo.

echo STEP 1: Open Terminal 1 (Backend)
echo Run these commands:
echo   cd c:\Users\ericv\final10\server
echo   npm start
echo.
echo Wait for: "Server running on port 5000"
echo.

echo STEP 2: Open Terminal 2 (Frontend) 
echo Run these commands:
echo   cd c:\Users\ericv\final10\client
echo   npm start
echo.
echo Look for: "🔧 Loading setupProxy.js..."
echo Then: "✅ Proxy middleware configured successfully"
echo Finally: "Local: http://localhost:3000"
echo.

echo STEP 3: Test Login
echo Go to http://localhost:3000
echo Try login with: demo@final10.com / demo123
echo.

echo ========================================
echo   CRITICAL: Use SEPARATE terminals!
echo ========================================
echo Terminal 1: Backend (port 5000)
echo Terminal 2: Frontend (port 3000)
echo.
echo The proxy only works when BOTH servers are running
echo and the frontend shows the proxy loading messages.
echo ========================================
echo.
pause

