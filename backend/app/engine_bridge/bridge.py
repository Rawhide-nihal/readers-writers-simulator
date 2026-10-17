import asyncio
import json
import logging
import platform
import os
import uuid
from typing import Dict, Any, Optional
from ..config import ENGINE_EXE, DB_PATH, SCHEMA_PATH, SEED_PATH
from ..websocket.manager import ws_manager
from ..storage.history import exp_storage

logger = logging.getLogger("engine_bridge")

class EngineBridge:
    def __init__(self):
        self.process: Optional[asyncio.subprocess.Process] = None
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.reader_task: Optional[asyncio.Task] = None
        self.is_running = False
        self.lock = asyncio.Lock()

    async def start(self):
        if self.is_running and self.process and self.process.returncode is None:
            return

        cmd = []
        # If running on Windows, invoke via WSL
        if platform.system() == "Windows":
            cwd_wsl = "/mnt/c/Users/metuk/Videos/New folder"
            cmd = ["wsl.exe", "-d", "Ubuntu", "--", "bash", "-c", 
                   f"cd '{cwd_wsl}' && ./engine/build/syncdb_engine --db database/syncdb.sqlite3 --schema database/schema.sql --seed database/seed.sql"]
        else:
            cmd = [ENGINE_EXE, "--db", DB_PATH, "--schema", SCHEMA_PATH, "--seed", SEED_PATH]

        logger.info(f"Launching C Engine: {' '.join(cmd)}")
        self.process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        self.is_running = True
        self.reader_task = asyncio.create_task(self._read_stdout_loop())
        asyncio.create_task(self._read_stderr_loop())

        # Wait briefly and ping to ensure readiness
        await asyncio.sleep(0.5)
        try:
            res = await self.send_command("ping", timeout=5.0)
            logger.info("C Engine handshake verified (ping -> pong)")
        except Exception as e:
            logger.warning(f"Engine initial handshake warning: {e}")

    async def stop(self):
        self.is_running = False
        if self.process and self.process.returncode is None:
            try:
                await self.send_command("shutdown", timeout=2.0)
            except Exception:
                pass
            try:
                self.process.terminate()
                await asyncio.wait_for(self.process.wait(), timeout=3.0)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
        if self.reader_task:
            self.reader_task.cancel()
        logger.info("C Engine stopped cleanly")

    async def send_command(self, command: str, params: Optional[Dict[str, Any]] = None, timeout: float = 15.0) -> Dict[str, Any]:
        if not self.is_running or not self.process or self.process.returncode is not None:
            # Attempt restart
            await self.start()

        req_id = f"REQ-{uuid.uuid4().hex[:8]}"
        future = asyncio.get_running_loop().create_future()
        self.pending_requests[req_id] = future

        msg = {
            "command": command,
            "req_id": req_id,
            "params": params or {}
        }

        line = json.dumps(msg) + "\n"
        async with self.lock:
            if not self.process or not self.process.stdin:
                raise RuntimeError("Engine process stdin unavailable")
            self.process.stdin.write(line.encode("utf-8"))
            await self.process.stdin.drain()

        try:
            response = await asyncio.wait_for(future, timeout=timeout)
            return response
        finally:
            self.pending_requests.pop(req_id, None)

    async def _read_stdout_loop(self):
        while self.is_running and self.process and self.process.stdout:
            line_bytes = await self.process.stdout.readline()
            if not line_bytes:
                break

            line = line_bytes.decode("utf-8", errors="replace").strip()
            if not line:
                continue

            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                logger.warning(f"Engine emitted non-JSON line: {line}")
                continue

            msg_type = msg.get("type")
            if msg_type == "response":
                req_id = msg.get("req_id")
                if req_id and req_id in self.pending_requests:
                    self.pending_requests[req_id].set_result(msg)
            elif msg_type == "event":
                # Stream out via WebSocket fanout
                await ws_manager.broadcast(msg)
                
                # Persist in experiment history
                exp_id = msg.get("exp_id")
                event_name = msg.get("event")
                if exp_id:
                    exp_storage.add_event(exp_id, msg)
                    if event_name == "EXPERIMENT_FINISHED":
                        details = msg.get("details", {})
                        exp_storage.complete_experiment(exp_id, details)

    async def _read_stderr_loop(self):
        while self.is_running and self.process and self.process.stderr:
            line_bytes = await self.process.stderr.readline()
            if not line_bytes:
                break
            line = line_bytes.decode("utf-8", errors="replace").strip()
            if line:
                logger.debug(f"[C ENGINE STDERR] {line}")

bridge = EngineBridge()
