import threading
import socket

from app import create_app
from db import db
from utils import ensure_first_admin_code, log_auth
from billing import start_billing_thread
from bot_setup import bot

app = create_app()

with app.app_context():
    db.create_all()
    ensure_first_admin_code()
    start_billing_thread(app)

try:
    local_ip = socket.gethostbyname(socket.gethostname())
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
