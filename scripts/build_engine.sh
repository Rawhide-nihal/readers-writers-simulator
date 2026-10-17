#!/usr/bin/env bash
# SyncDB Lab - C Engine Build Script
# Group G-15: Readers–Writers Concurrent Database Simulator
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=================================================="
echo " Building SyncDB Lab C Engine (CMake & C11 POSIX)"
echo "=================================================="

mkdir -p engine/build
cmake -B engine/build -S engine
cmake --build engine/build

echo "[INFO] Running engine correctness test suite..."
./engine/build/test_correctness

echo "=================================================="
echo " Build successful: engine/build/syncdb_engine"
echo "=================================================="
