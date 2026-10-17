#!/usr/bin/env bash
# SyncDB Lab - Clean Artifacts Script
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "Cleaning build artifacts and temporary files..."

rm -rf engine/build
rm -rf frontend/dist
rm -rf frontend/node_modules/.vite
rm -rf .pytest_cache backend/tests/.pytest_cache
rm -f database/syncdb.sqlite3 database/syncdb.sqlite3-shm database/syncdb.sqlite3-wal /tmp/syncdb*
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo "Cleanup complete."
