#!/bin/bash

# Function to safely shut down the backend when you exit the script
cleanup() {
    echo -e "\nShutting down systems..."
    kill $BACKEND_PID
    exit 0
}

# Trap Ctrl+C to run the cleanup function
trap cleanup SIGINT

echo "====================================="
echo "🧙 Starting Gandalf Watchman Systems "
echo "====================================="

# 1. Start the Gandalf Backend
echo "[1/2] Starting FastAPI Backend..."
cd ./backend

# Activate the existing virtual environment
source ../venv/bin/activate

# Run main.p3y instead of app.main
uvicorn main:app --port 8000 &
BACKEND_PID=$!

# Give the backend a second to initialize
sleep 2

# 2. Start the React Frontend
echo "[2/2] Starting React UI..."
cd /home/akshatbaranwal/codes/Websites/v1/react_version

# Runs the frontend
npm run dev

# Script will hold here until you press Ctrl+C, at which point trap will kill the backend
