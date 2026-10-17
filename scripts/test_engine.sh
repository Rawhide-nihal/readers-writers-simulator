#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "Running C engine test..."
printf '{"command":"ping","req_id":"req-001"}\n{"command":"list_accounts","req_id":"req-002"}\n{"command":"status","req_id":"req-003"}\n{"command":"shutdown","req_id":"req-004"}\n' | ./engine/build/syncdb_engine
