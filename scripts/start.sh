#!/usr/bin/env bash
# SyncDB Lab - Complete Application Startup Script
# Group G-15: Readers–Writers Concurrent Database Simulator
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=================================================="
echo " Starting SyncDB Lab (Group G-15)"
echo " Readers–Writers Concurrent Database Simulator"
echo "=================================================="

# 1. Verify C Engine
if [ ! -f "engine/build/syncdb_engine" ]; then
    echo "[INFO] C engine binary not found. Building now..."
    ./scripts/build_engine.sh
fi

# 2. Verify Python Virtual Environment
if [ ! -d "backend/venv" ]; then
    echo "[INFO] Python virtual environment not found. Running setup..."
    python3 -m venv backend/venv
    ./backend/venv/bin/pip install -r backend/requirements.txt
fi

# 3. Check for port conflicts
if command -v lsof >/dev/null 2>&1; then
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
        echo "[WARNING] Port 8000 is already in use. Attempting to free or check process..."
    fi
    if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
        echo "[WARNING] Port 5173 is already in use."
    fi
fi

# Cleanup on exit
cleanup() {
    echo ""
    echo "[INFO] Stopping SyncDB Lab services cleanly..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    wait 2>/dev/null || true
    echo "[INFO] All services stopped."
}
trap cleanup SIGINT SIGTERM EXIT

# 4. Start FastAPI Backend
echo "[INFO] Launching FastAPI Backend on http://127.0.0.1:8000..."
export PYTHONPATH="$DIR"
./backend/venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait briefly for backend startup
sleep 2

# 5. Start Vite Frontend
echo "[INFO] Launching Vite Frontend on http://127.0.0.1:5173..."
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!
cd "$DIR"

echo ""
echo "=================================================="
echo " SyncDB Lab is live and running!"
echo "   Frontend Web UI:   http://localhost:5173"
echo "   Backend REST API:  http://127.0.0.1:8000"
echo "   API Documentation: http://127.0.0.1:8000/docs"
echo "=================================================="
echo " Press Ctrl+C to stop all services."
echo ""

# Keep running
wait "$BACKEND_PID" "$FRONTEND_PID"
