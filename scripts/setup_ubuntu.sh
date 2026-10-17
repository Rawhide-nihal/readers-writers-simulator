#!/usr/bin/env bash
# SyncDB Lab - Ubuntu Environment Setup Script
# Group G-15: Readers–Writers Concurrent Database Simulator
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=================================================="
echo " SyncDB Lab - Ubuntu Environment Setup (Group G-15)"
echo "=================================================="

# Check Ubuntu
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "[INFO] Detected OS: $NAME $VERSION"
else
    echo "[WARNING] Not running on standard Linux /etc/os-release."
fi

# 1. Update and install system dependencies
echo "[1/5] Checking and installing apt build dependencies..."
SUDO=""
if [ "$EUID" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        echo "[ERROR] Root privileges or sudo required to install apt packages."
        exit 1
    fi
fi

$SUDO apt-get update
$SUDO apt-get install -y \
    build-essential \
    gcc \
    cmake \
    pkg-config \
    libsqlite3-dev \
    libcjson-dev \
    python3 \
    python3-venv \
    python3-pip \
    sqlite3 \
    nodejs \
    npm \
    git

# 2. Build C Synchronization Engine
echo "[2/5] Building C POSIX synchronization engine..."
mkdir -p engine/build
cmake -B engine/build -S engine
cmake --build engine/build

# 3. Setup Python Backend Virtual Environment
echo "[3/5] Setting up Python backend virtual environment..."
if [ ! -d "backend/venv" ]; then
    python3 -m venv backend/venv
fi
./backend/venv/bin/pip install --upgrade pip
./backend/venv/bin/pip install -r backend/requirements.txt

# 4. Install Frontend Dependencies
echo "[4/5] Installing React frontend dependencies..."
cd frontend
npm install
cd "$DIR"

# 5. Run Verification Tests
echo "[5/5] Running verification tests..."
./engine/build/test_correctness

echo ""
echo "=================================================="
echo " Setup complete! Group G-15 SyncDB Lab is ready."
echo " To start the application, run: ./scripts/start.sh"
echo "=================================================="
