from flask import Flask, jsonify, request, abort, send_from_directory
from pathlib import Path
import json
import hmac
import hashlib
from urllib.parse import parse_qsl

from config import TG_BOT_TOKEN
from db import init_db, create_zero_user, upsert_user_from_tg, is_user_allowed, get_user_payload

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = (BASE_DIR.parent / "frontend").resolve()

app = Flask(__name__)

# --- no cache: чтобы Telegram не держал старые файлы ---
@app.after_request
def add_no_cache(resp):
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

def check_init_data(init_data: str) -> dict:
    """
    Проверка подписи Telegram WebApp initData.
    Возвращает dict параметров (user будет JSON-строкой).
    """
    if not TG_BOT_TOKEN:
        raise RuntimeError("TG_BOT_TOKEN is not set in environment")

    data = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = data.pop("hash", None)
    if not received_hash:
        raise ValueError("No hash in initData")

    check_string = "\n".join(f"{k}={data[k]}" for k in sorted(data.keys()))

    secret_key = hmac.new(b"WebAppData", TG_BOT_TOKEN.encode(), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise ValueError("Bad hash")

    return data

def get_tg_user_from_request() -> dict:
    body = request.get_json(silent=True) or {}
    init_data = (body.get("initData") or "").strip()
    if not init_data:
        abort(401)

    try:
        parsed = check_init_data(init_data)
        user_raw = parsed.get("user") or "{}"
        tg_user = json.loads(user_raw)
        if not tg_user.get("id"):
            abort(401)
        return tg_user
    except Exception:
        abort(401)

# ---------- AUTH ----------
@app.post("/api/auth")
def api_auth():
    tg_user = get_tg_user_from_request()
    tg_user_id = int(tg_user["id"])

    # Доступ только тем, кто есть в БД и активен
    if not is_user_allowed(tg_user_id):
        abort(403)

    # Обновим имя/юзернейм в БД (upsert), но НЕ создаём новых “проходных” пользователей
    upsert_user_from_tg(tg_user)

    return jsonify({"ok": True, "user": tg_user})

# ---------- API ----------
@app.post("/api/user")
def api_user():
    tg_user = get_tg_user_from_request()
    tg_user_id = int(tg_user["id"])

    if not is_user_allowed(tg_user_id):
        abort(403)

    # Здесь уже можно создавать запись, если хочешь автосоздание.
    # Сейчас делаем upsert только для тех, кто уже разрешён.
    upsert_user_from_tg(tg_user)

    return jsonify(get_user_payload(tg_user_id))

@app.post("/api/vpn")
def api_vpn():
    tg_user = get_tg_user_from_request()
    tg_user_id = int(tg_user["id"])
    if not is_user_allowed(tg_user_id):
        abort(403)

    # Заглушки подключений
    return jsonify([
        {
            "id": "de1",
            "name": "Germany #1",
            "status": "online",
            "expires": "2026-03-01",
            "config": "vless://TEST-UUID@de1.example.com:443?encryption=none&security=tls&type=ws#Germany%20%231"
        },
        {
            "id": "nl2",
            "name": "Netherlands #2",
            "status": "offline",
            "expires": "2026-02-15",
            "config": "vless://TEST-UUID@nl2.example.com:443?encryption=none&security=tls&type=ws#Netherlands%20%232"
        },
        {
            "id": "fi1",
            "name": "Finland #1",
            "status": "online",
            "expires": "2026-04-10",
            "config": "vless://TEST-UUID@fi1.example.com:443?encryption=none&security=tls&type=ws#Finland%20%231"
        }
    ])

@app.post("/api/tariffs")
def api_tariffs():
    tg_user = get_tg_user_from_request()
    tg_user_id = int(tg_user["id"])
    if not is_user_allowed(tg_user_id):
        abort(403)

    return jsonify([
        {"months": 1, "price_rub": 150},
        {"months": 6, "price_rub": 700},
        {"months": 12, "price_rub": 1200},
    ])

# ---------- Frontend ----------
@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.get("/<path:filename>")
def frontend_files(filename: str):
    return send_from_directory(FRONTEND_DIR, filename)

def sanity():
    if not FRONTEND_DIR.exists():
        raise RuntimeError(f"FRONTEND_DIR not found: {FRONTEND_DIR}")
    for f in ["index.html", "styles.css", "app.js"]:
        if not (FRONTEND_DIR / f).exists():
            raise RuntimeError(f"Missing file: {FRONTEND_DIR / f}")

if __name__ == "__main__":
    sanity()
    init_db()
    create_zero_user()
    app.run(host="0.0.0.0", port=8000, debug=True)
