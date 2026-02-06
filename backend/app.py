from flask import Flask, jsonify, request, abort, send_from_directory
from pathlib import Path
import json
import hmac
import hashlib
from urllib.parse import parse_qsl
import os

def load_tariffs():
    p = (BASE_DIR / "tariffs.json").resolve()
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

from config import TG_BOT_TOKEN
from db import (
    init_db, create_zero_user,
    get_user_by_tg_id, is_user_allowed, is_admin,
    upsert_user_from_tg, get_user_payload,
    redeem_invite, create_invite,
    admin_list_users, admin_set_balance, admin_set_tariff, admin_delete_user,
    admin_list_configs, admin_add_config, admin_update_config, admin_delete_config,
)

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = (BASE_DIR.parent / "frontend").resolve()

app = Flask(__name__)

@app.after_request
def add_no_cache(resp):
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

def check_init_data(init_data: str) -> dict:
    if not TG_BOT_TOKEN:
        raise RuntimeError("TG_BOT_TOKEN is not set")

    data = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = data.pop("hash", None)
    if not received_hash:
        raise ValueError("No hash")

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

def require_admin(tg_user_id: int):
    if not is_admin(tg_user_id):
        abort(403)

# ---------- AUTH ----------
@app.post("/api/auth")
def api_auth():
    """
    Если пользователь уже есть в БД и активен — OK.
    Если нет — возвращаем 403 (UI покажет ввод инвайт-кода).
    """
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])

    if not is_user_allowed(tg_id):
        abort(403)

    # обновляем профильные поля
    upsert_user_from_tg(tg_user)
    payload = get_user_payload(tg_id)
    return jsonify({"ok": True, "me": payload})

@app.post("/api/redeem")
def api_redeem():
    tg_user = get_tg_user_from_request()
    body = request.get_json(silent=True) or {}
    code = (body.get("code") or "").strip()
    if not code:
        abort(400)

    try:
        redeem_invite(tg_user, code)
    except KeyError:
        # неверный/использованный/неактивный инвайт
        abort(400)
    except ValueError:
        abort(400)

    # успех: возвращаем me чтобы фронт мог сразу войти
    tg_id = int(tg_user["id"])
    upsert_user_from_tg(tg_user)
    payload = get_user_payload(tg_id)
    return jsonify({"ok": True, "me": payload})

# ---------- USER API ----------
@app.post("/api/me")
def api_me():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    if not is_user_allowed(tg_id):
        abort(403)
    upsert_user_from_tg(tg_user)
    return jsonify(get_user_payload(tg_id))

@app.post("/api/my_configs")
def api_my_configs():
    """
    Пользователь видит только свои конфиги (редактирование только у админа).
    """
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    if not is_user_allowed(tg_id):
        abort(403)

    # выдаём конфиги из vpn_configs по tg_id (через admin_list_configs переиспользуем)
    # (это админ-функция, но чтение для себя ок)
    return jsonify(admin_list_configs(tg_id))

# ---------- ADMIN ----------
@app.post("/api/admin/tariffs")
def api_admin_tariffs():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)
    return jsonify(load_tariffs())

@app.post("/api/admin/invite")
def api_admin_invite():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)

    body = request.get_json(silent=True) or {}
    role = (body.get("role") or "user").strip()
    code = create_invite(tg_id, role)
    return jsonify({"ok": True, "code": code, "role": role})

@app.post("/api/admin/users")
def api_admin_users():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)
    return jsonify(admin_list_users())

@app.post("/api/admin/user/set_balance")
def api_admin_set_balance():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)

    body = request.get_json(silent=True) or {}
    target = int(body.get("target_tg_user_id"))
    balance = float(body.get("balance_rub"))
    admin_set_balance(target, balance)
    return jsonify({"ok": True})

@app.post("/api/admin/user/set_tariff")
def api_admin_set_tariff():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)

    body = request.get_json(silent=True) or {}
    target = int(body.get("target_tg_user_id"))
    name = str(body.get("tariff_name") or "Basic")
    price = int(body.get("tariff_price_rub") or 150)
    period = int(body.get("tariff_period_months") or 1)

    admin_set_tariff(target, name, price, period)
    return jsonify({"ok": True})

@app.post("/api/admin/user/delete")
def api_admin_delete_user():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)

    body = request.get_json(silent=True) or {}
    target = int(body.get("target_tg_user_id"))
    admin_delete_user(target)
    return jsonify({"ok": True})

@app.post("/api/admin/configs/list")
def api_admin_configs_list():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)

    body = request.get_json(silent=True) or {}
    target = int(body.get("target_tg_user_id"))
    return jsonify(admin_list_configs(target))

@app.post("/api/admin/configs/add")
def api_admin_configs_add():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)

    body = request.get_json(silent=True) or {}
    target = int(body.get("target_tg_user_id"))
    title = str(body.get("title") or "Config")
    config_text = str(body.get("config_text") or "")
    if not config_text.strip():
        abort(400)
    admin_add_config(target, title, config_text)
    return jsonify({"ok": True})

@app.post("/api/admin/configs/update")
def api_admin_configs_update():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)

    body = request.get_json(silent=True) or {}
    config_id = int(body.get("config_id"))
    title = str(body.get("title") or "Config")
    config_text = str(body.get("config_text") or "")
    is_active = int(body.get("is_active") or 1)
    admin_update_config(config_id, title, config_text, is_active)
    return jsonify({"ok": True})

@app.post("/api/admin/configs/delete")
def api_admin_configs_delete():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)

    body = request.get_json(silent=True) or {}
    config_id = int(body.get("config_id"))
    admin_delete_config(config_id)
    return jsonify({"ok": True})

# ---------- Frontend ----------
@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.get("/<path:filename>")
def frontend_files(filename: str):
    return send_from_directory(FRONTEND_DIR, filename)

@app.post("/api/check-admin-auth")
def api_check_admin_auth():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    is_admin_user = is_admin(tg_id)
    return jsonify({"isAdmin": is_admin_user})

@app.post("/api/admin-content")
def api_admin_content():
    tg_user = get_tg_user_from_request()
    tg_id = int(tg_user["id"])
    require_admin(tg_id)

    users = admin_list_users()
    tariffs = load_tariffs()

    return jsonify({
        "users": [
            {
                "name": user.get('first_name', '') + ' ' + user.get('username', ''),
                "tg_id": user.get('tg_user_id')
            } for user in users
        ],
        "tariffs": tariffs
    })

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
