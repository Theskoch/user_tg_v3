import os
import threading
import socket

from app import create_app, FRONTEND_DIR
from db import db
from utils import ensure_first_admin_code, log_auth, LOG_PATH
from billing import start_billing_thread
from bot_setup import bot

app = create_app()

with app.app_context():
    db.create_all()
    admin_code = ensure_first_admin_code()
    start_billing_thread(app)

# ── Startup info ──────────────────────────────────────────────────────────────
try:
    local_ip = socket.gethostbyname(socket.gethostname())
except Exception:
    local_ip = '?'

db_uri  = os.environ.get('DATABASE_URL', 'sqlite:///users.db')
bot_status = '✓  активен' if bot else '✗  не настроен (BOT_TOKEN не задан)'

print('\n' + '─' * 54)
print('  🚀  VPN App запущен')
print('─' * 54)
print(f'  Адрес        :  http://0.0.0.0:5000  (LAN: {local_ip})')
print(f'  База данных  :  {db_uri}')
print(f'  Лог файл     :  {LOG_PATH}')
print(f'  Фронтенд     :  {FRONTEND_DIR}')
print(f'  Telegram бот :  {bot_status}')
if admin_code:
    print('─' * 54)
    print(f'  🔑  КОД ПЕРВОГО АДМИНИСТРАТОРА:')
    print(f'      {admin_code}')
print('─' * 54 + '\n')

try:
    log_auth('server_start', host='0.0.0.0', port=5000, local_ip=local_ip)
except Exception:
    pass

if bot:
    try:
        bot.delete_webhook(drop_pending_updates=True)
    except Exception:
        pass
    threading.Thread(target=lambda: bot.infinity_polling(skip_pending=True), daemon=True).start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
