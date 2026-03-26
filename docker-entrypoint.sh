#!/bin/bash

# docker-entrypoint.sh
# This script starts both the FastAPI backend and React frontend inside the Docker container.

echo "====================================="
echo "🧙 Starting Gandalf Container Systems"
echo "====================================="

echo "[1/2] Starting FastAPI Backend..."
cd /app/backend
# No virtual environment needed in Docker
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

sleep 2

echo "[2/2] Starting React UI..."
cd /app
# Run the frontend (binding to 0.0.0.0 so it can be accessed outside the container)
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
