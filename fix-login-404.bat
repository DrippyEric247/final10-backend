@echo off
echo ========================================
echo   Fixing Login 404 Error
echo ========================================
echo.

echo Step 1: Stopping all Node.js processes...
taskkill /f /im node.exe 2>nul
echo ✅ All Node.js processes stopped
echo.

echo Step 2: Starting Backend Server...
echo Please open a new terminal and run:
echo   cd c:\Users\ericv\final10\server
echo   npm start
echo.
echo Wait for the backend to show "Server running on port 5000"
echo.

echo Step 3: Starting Frontend Server...
echo Then open another terminal and run:
echo   cd c:\Users\ericv\final10\client
echo   npm start
echo.
echo Wait for the frontend to show "Local: http://localhost:3000"
echo.

echo Step 4: Test the login...
echo Once both servers are running, try logging in again.
echo The proxy should now work correctly.
echo.

echo ========================================
echo   Manual Steps Summary:
echo ========================================
echo 1. Terminal 1: cd c:\Users\ericv\final10\server ^&^& npm start
echo 2. Terminal 2: cd c:\Users\ericv\final10\client ^&^& npm start
echo 3. Test login in browser
echo ========================================
echo.
pause

