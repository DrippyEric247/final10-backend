# PowerShell script to start both servers
Write-Host "Starting Backend Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\ericv\final10\server'; npm start"

Start-Sleep -Seconds 3

Write-Host "Starting Frontend Server..." -ForegroundColor Green  
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\ericv\final10\client'; npm start"

Write-Host "Both servers are starting in separate windows..." -ForegroundColor Yellow
Write-Host "Wait for both to show 'Server running on port 5000' and 'Local: http://localhost:3000'" -ForegroundColor Yellow
Write-Host "Then test login at http://localhost:3000" -ForegroundColor Cyan

