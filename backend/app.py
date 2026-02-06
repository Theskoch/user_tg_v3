import hashlib
import hmac
import json
import os
import secrets
import urllib.parse

from flask import Flask, request, jsonify, send_from_directory, abort

from config import (
    BOT_TOKEN,
    INITIAL_ADMIN_TG_ID,
    INITIAL_ADMIN_FIRST_NAME,
    INITIAL_ADMIN_USERNAME,
    INITIAL_ADMIN_BALANCE,
    INITIAL_ADMIN_TARIFF_ID,
)
from db import (
    init_db,
    upsert_user,
    get_user_by_tg_id,
    list_users,
    set_user_balance,
    set_user_tariff,
    delete_user,
    list_configs,
    add_config,
    delete_config,
    create_invite,
    redeem_invite,
    cleanup_invites,
)

APP_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(APP_DIR, "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

# ---------- Telegram initData verification ----------
def parse_init_data(init_data: str) -> dict:
    data = urllib.parse.parse_qs(init_data, strict_parsing=False)
    return {k: v[0] for k, v in data.items()}

def verify_init_data(init_data: str) -> bool:
    if not BOT_TOKEN:
        return False
    data = parse_init_data(init_data)
    if "hash" not in data:
        return False
    received_hash = data.pop("hash")

    pairs = [f"{k}={data[k]}" for k in sorted(data.keys())]
    data_check_string = "\n".join(pairs).encode("utf-8")

    secret_key = hashlib.sha256(BOT_TOKEN.encode("utf-8")).digest()
    calculated_hash = hmac.new(secret_key, data_check_string, hashlib.sha256).hexdigest()
    return hmac.compare_digest(calculated_hash, received_hash)

def get_tg_user_from_init(init_data: str) -> dict:
    data = parse_init_data(init_data)
    user_json = data.get("user")
    if not user_json:
        return {}
    try:
        return json.loads(user_json)
    except Exception:
        return {}

def require_telegram():
    body = request.get_json(silent=True) or {}
    init_data = body.get("initData", "")
    if not init_data:
        abort(401)
    if not verify_init_data(init_data):
        abort(401)
    return init_data

def require_user():
    init_data = require_telegram()
    tg_user = get_tg_user_from_init(init_data)
    tg_id = tg_user.get("id")
    if not tg_id:
        abort(401)
    user = get_user_by_tg_id(int(tg_id))
    if not user:
        abort(403)
    return tg_user, user

def require_admin():
    tg_user, user = require_user()
    if user["role"] != "admin":
        abort(403)
    return tg_user, user

# ---------- Tariffs ----------
def load_tariffs():
    path = os.path.join(FRONTEND_DIR, "tariffs.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)["tariffs"]

def tariff_by_id(tariffs, tariff_id):
    for t in tariffs:
        if int(t["id"]) == int(tariff_id):
            return t
    return None

# ---------- Static ----------
@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.get("/<path:path>")
def static_proxy(path):
    return send_from_directory(FRONTEND_DIR, path)

# ---------- API ----------
@app.post("/api/tariffs")
def api_tariffs():
    require_telegram()
    return jsonify({"tariffs": load_tariffs()})

@app.post("/api/auth")
def api_auth():
    tg_user, user = require_user()
    tariffs = load_tariffs()
    t = tariff_by_id(tariffs, user["tariff_id"]) if user["tariff_id"] else None
    return jsonify({
        "me": {
            "tg_user_id": user["tg_user_id"],
            "first_name": user["first_name"],
            "username": user["username"],
            "role": user["role"],
            "balance_rub": user["balance_rub"],
            "tariff_id": user["tariff_id"],
            "tariff": t
        }
    })

@app.post("/api/redeem")
def api_redeem():
    init_data = require_telegram()
    tg = get_tg_user_from_init(init_data)
    tg_id = int(tg.get("id", 0))
    if not tg_id:
        abort(401)

    body = request.get_json(silent=True) or {}
    code = (body.get("code") or body.get("invite_code") or "").strip()
    if not code:
        return jsonify({"ok": False, "error": "NO_CODE"}), 400

    inv = redeem_invite(code, tg_id)
    if not inv:
        return jsonify({"ok": False, "error": "INVALID_CODE"}), 400

    role = inv["role"]
    tariffs = load_tariffs()
    default_tariff = tariffs[0]["id"] if tariffs else 1

    upsert_user(
        tg_user_id=tg_id,
        first_name=tg.get("first_name") or "",
        username=tg.get("username") or "",
        role=role,
        balance=0.0,
        tariff_id=default_tariff
    )
    return jsonify({"ok": True, "role": role})

@app.post("/api/my_configs")
def api_my_configs():
    _, user = require_user()
    rows = list_configs(user["tg_user_id"])
    return jsonify([dict(r) for r in rows])

# ---------- Admin ----------
@app.post("/api/admin/users")
def api_admin_users():
    require_admin()
    tariffs = load_tariffs()
    rows = list_users()
    out = []
    for r in rows:
        t = tariff_by_id(tariffs, r["tariff_id"]) if r["tariff_id"] else None
        out.append({
            "tg_user_id": r["tg_user_id"],
            "first_name": r["first_name"],
            "username": r["username"],
            "role": r["role"],
            "balance_rub": r["balance_rub"],
            "tariff_id": r["tariff_id"],
            "tariff_name": (t["name"] if t else None)
        })
    return jsonify(out)

@app.post("/api/admin/invite")
def api_admin_invite():
    require_admin()
    cleanup_invites()
    body = request.get_json(silent=True) or {}
    role = body.get("role")
    if role not in ("admin", "user"):
        return jsonify({"ok": False, "error": "BAD_ROLE"}), 400
    code = secrets.token_urlsafe(24)  # одноразовый, ~32-36 символов
    create_invite(code, role)
    return jsonify({"ok": True, "code": code})

@app.post("/api/admin/user/set_balance")
def api_admin_set_balance():
    require_admin()
    body = request.get_json(silent=True) or {}
    tg_id = int(body.get("target_tg_user_id", 0))
    balance = body.get("balance_rub", None)
    if not tg_id or balance is None:
        return jsonify({"ok": False, "error": "BAD_INPUT"}), 400
    set_user_balance(tg_id, float(balance))
    return jsonify({"ok": True})

@app.post("/api/admin/user/set_tariff")
def api_admin_set_tariff():
    require_admin()
    body = request.get_json(silent=True) or {}
    tg_id = int(body.get("target_tg_user_id", 0))
    tariff_id = int(body.get("tariff_id", 0))
    if not tg_id or not tariff_id:
        return jsonify({"ok": False, "error": "BAD_INPUT"}), 400
    tariffs = load_tariffs()
    if not tariff_by_id(tariffs, tariff_id):
        return jsonify({"ok": False, "error": "NO_SUCH_TARIFF"}), 400
    set_user_tariff(tg_id, tariff_id)
    return jsonify({"ok": True})

@app.post("/api/admin/user/delete")
def api_admin_delete_user():
    require_admin()
    body = request.get_json(silent=True) or {}
    tg_id = int(body.get("target_tg_user_id", 0))
    if not tg_id:
        return jsonify({"ok": False, "error": "BAD_INPUT"}), 400
    delete_user(tg_id)
    return jsonify({"ok": True})

@app.post("/api/admin/configs/list")
def api_admin_configs_list():
    require_admin()
    body = request.get_json(silent=True) or {}
    tg_id = int(body.get("target_tg_user_id", 0))
    if not tg_id:
        return jsonify({"ok": False, "error": "BAD_INPUT"}), 400
    rows = list_configs(tg_id)
    return jsonify([dict(r) for r in rows])

@app.post("/api/admin/configs/add")
def api_admin_configs_add():
    require_admin()
    body = request.get_json(silent=True) or {}
    tg_id = int(body.get("target_tg_user_id", 0))
    title = (body.get("title") or "Config").strip()
    config_text = (body.get("config_text") or "").strip()
    if not tg_id or not config_text:
        return jsonify({"ok": False, "error": "BAD_INPUT"}), 400
    add_config(tg_id, title, config_text)
    return jsonify({"ok": True})

@app.post("/api/admin/configs/delete")
def api_admin_configs_delete():
    require_admin()
    body = request.get_json(silent=True) or {}
    tg_id = int(body.get("target_tg_user_id", 0))
    config_id = int(body.get("config_id", 0))
    if not tg_id or not config_id:
        return jsonify({"ok": False, "error": "BAD_INPUT"}), 400
    changed = delete_config(config_id, tg_id)
    return jsonify({"ok": True, "changed": changed})

if __name__ == "__main__":
    init_db()

    # Первый админ всегда задаётся через ENV и апсёртится при старте
    upsert_user(
        tg_user_id=INITIAL_ADMIN_TG_ID,
        first_name=INITIAL_ADMIN_FIRST_NAME,
        username=INITIAL_ADMIN_USERNAME,
        role="admin",
        balance=INITIAL_ADMIN_BALANCE,
        tariff_id=INITIAL_ADMIN_TARIFF_ID
    )

    app.run(host="0.0.0.0", port=8000, debug=False)
