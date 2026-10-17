from pathlib import Path
import os
import platform

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATABASE_DIR = BASE_DIR / "database"
ENGINE_DIR = BASE_DIR / "engine"

DB_PATH = str(DATABASE_DIR / "syncdb.sqlite3")
SCHEMA_PATH = str(DATABASE_DIR / "schema.sql")
SEED_PATH = str(DATABASE_DIR / "seed.sql")

# Detect platform and binary path
if platform.system() == "Windows":
    # If compiled inside WSL / Linux
    ENGINE_EXE = str(ENGINE_DIR / "build" / "syncdb_engine")
else:
    ENGINE_EXE = str(ENGINE_DIR / "build" / "syncdb_engine")

HOST = os.getenv("SYNCDB_HOST", "127.0.0.1")
PORT = int(os.getenv("SYNCDB_PORT", "8000"))
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]
