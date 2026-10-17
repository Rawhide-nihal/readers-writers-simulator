import asyncio
import json
from typing import List, Dict, Any
from collections import deque
from fastapi import WebSocket

class WebSocketManager:
    def __init__(self, max_history: int = 1000):
        self.active_connections: List[WebSocket] = []
        self.lock = asyncio.Lock()
        self.recent_events: deque = deque(maxlen=max_history)

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.active_connections.append(websocket)
            # Send current recent history snapshot to new connection
            for event in list(self.recent_events)[-50:]:
                try:
                    await websocket.send_text(json.dumps(event))
                except Exception:
                    pass

    async def disconnect(self, websocket: WebSocket):
        async with self.lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        async with self.lock:
            self.recent_events.append(message)
            stale = []
            msg_text = json.dumps(message)
            for conn in self.active_connections:
                try:
                    await conn.send_text(msg_text)
                except Exception:
                    stale.append(conn)
            for s in stale:
                if s in self.active_connections:
                    self.active_connections.remove(s)

    def get_recent_events(self, limit: int = 200) -> List[Dict[str, Any]]:
        return list(self.recent_events)[-limit:]

ws_manager = WebSocketManager()
