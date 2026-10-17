import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .config import CORS_ORIGINS
from .engine_bridge.bridge import bridge
from .websocket.manager import ws_manager
from .api.routes import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("syncdb_backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SyncDB Lab Backend (Group G-15)...")
    await bridge.start()
    yield
    logger.info("Shutting down SyncDB Lab Backend...")
    await bridge.stop()

app = FastAPI(
    title="SyncDB Lab - Readers–Writers Concurrent Database Simulator",
    description="Full-Stack Operating Systems Project with real POSIX threads and genuine SQLite concurrency",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection open; receive client pings if any
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)

@app.get("/")
async def root_info():
    return {
        "project": "Readers–Writers Concurrent Database Simulator",
        "app_name": "SyncDB Lab",
        "group": "G-15",
        "team": [
            {"name": "B. Thrinadh", "roll": "2520030529"},
            {"name": "Madhan", "roll": "2520030263"},
            {"name": "M. Nihal", "roll": "2520030124"}
        ],
        "api_docs": "/docs",
        "health_check": "/api/health"
    }
