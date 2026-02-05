import os

# ВАЖНО: задай токен в переменной окружения, а не в коде:
# export TG_BOT_TOKEN="123:ABC..."
TG_BOT_TOKEN = os.getenv("TG_BOT_TOKEN", "").strip()

# SQLite файл БД
DB_PATH = os.getenv("DB_PATH", "/root/testvp3/user_tg_v3/data/app.sqlite3")

# Нулевой пользователь (seed). Можно задать env-ом:
# export ZERO_TG_USER_ID="123456789"
ZERO_TG_USER_ID = int(os.getenv("ZERO_TG_USER_ID", "0") or "0")
ZERO_NAME = os.getenv("ZERO_NAME", "Zero User")
