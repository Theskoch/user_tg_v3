import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = str(DATA_DIR / "app.db")

# ОБЯЗАТЕЛЬНО для прод: токен бота, который открывает mini app
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# В DEV можно временно отключить проверку подписи initData
DEV_DISABLE_INITDATA_VERIFY = os.getenv("DEV_DISABLE_INITDATA_VERIFY", "0") == "1"

# Нулевой админ (создаётся командой init)
ZERO_ADMIN_TG_ID = int(os.getenv("ZERO_ADMIN_TG_ID", "424431134"))
ZERO_ADMIN_FIRST_NAME = os.getenv("ZERO_ADMIN_FIRST_NAME", "A")
ZERO_ADMIN_USERNAME = os.getenv("ZERO_ADMIN_USERNAME", "admin")
ZERO_ADMIN_BALANCE = float(os.getenv("ZERO_ADMIN_BALANCE", "100"))
ZERO_ADMIN_TARIFF_ID = int(os.getenv("ZERO_ADMIN_TARIFF_ID", "1"))
