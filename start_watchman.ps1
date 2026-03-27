# Function to clean up backend on exit
function Cleanup {
    Write-Host "`nShutting down systems..."
    if ($backendProcess) {
        Stop-Process -Id $backendProcess.Id -Force
    }
    exit
}

# Handle Ctrl+C
$null = Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

Write-Host "====================================="
Write-Host "🧙 Starting Gandalf Watchman Systems"
Write-Host "====================================="

# 1. Start Backend
Write-Host "[1/2] Starting FastAPI Backend..."
Set-Location ./backend

# Start backend using global Python (no venv)
$backendProcess = Start-Process python -ArgumentList "-m uvicorn main:app --port 8000" -PassThru

# Wait for backend to initialize
Start-Sleep -Seconds 2

# 2. Start Frontend
Write-Host "[2/2] Starting React UI..."
cd ..

Write-Host "Installing frontend dependencies..."
npm install

Write-Host "Starting React dev server..."
npm run dev

# When frontend stops, cleanup runs automatically
Cleanup