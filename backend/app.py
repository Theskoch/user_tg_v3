from flask import Flask, jsonify, send_from_directory
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent              # /root/testvp3/user_tg_v3/backend
FRONTEND_DIR = (BASE_DIR.parent / "frontend").resolve() # /root/testvp3/user_tg_v3/frontend

app = Flask(__name__)

# --- no cache (чтобы Telegram не держал старьё) ---
@app.after_request
def add_no_cache(resp):
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

# ---------- API (заглушки) ----------
@app.get("/api/user")
def api_user():
    return jsonify({
        "balance_rub": 325.50,
        "tariff_name": "Basic",
        "tariff_price_text": "150 ₽/мес",
        "next_charge": "01.01.2026"
    })

@app.get("/api/vpn")
def api_vpn():
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

@app.get("/api/tariffs")
def api_tariffs():
    return jsonify([
        {"months": 1, "price_rub": 150},
        {"months": 6, "price_rub": 700},
        {"months": 12, "price_rub": 1200},
    ])

# ---------- Frontend ----------
@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

# раздаём файлы напрямую: /styles.css, /app.js
@app.get("/<path:filename>")
def frontend_files(filename: str):
    return send_from_directory(FRONTEND_DIR, filename)

def sanity():
    if not FRONTEND_DIR.exists():
        raise RuntimeError(f"FRONTEND_DIR not found: {FRONTEND_DIR}")
    needed = ["index.html", "styles.css", "app.js"]
    for f in needed:
        if not (FRONTEND_DIR / f).exists():
            raise RuntimeError(f"Missing: {FRONTEND_DIR / f}")

if __name__ == "__main__":
    sanity()
    # раз ты уже поднял через 0.0.0.0 — оставь так
    app.run(host="0.0.0.0", port=8000, debug=True)
