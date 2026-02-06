import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = str(DATA_DIR / "app.db")

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is required")

INITIAL_ADMIN_TG_ID = int(os.getenv("INITIAL_ADMIN_TG_ID", "0"))
if INITIAL_ADMIN_TG_ID <= 0:
    raise RuntimeError("INITIAL_ADMIN_TG_ID is required and must be > 0")

INITIAL_ADMIN_FIRST_NAME = os.getenv("INITIAL_ADMIN_FIRST_NAME", "Admin")
INITIAL_ADMIN_USERNAME = os.getenv("INITIAL_ADMIN_USERNAME", "admin")
INITIAL_ADMIN_BALANCE = float(os.getenv("INITIAL_ADMIN_BALANCE", "100"))
INITIAL_ADMIN_TARIFF_ID = int(os.getenv("INITIAL_ADMIN_TARIFF_ID", "1"))

INVITE_TTL_DAYS = int(os.getenv("INVITE_TTL_DAYS", "7"))
