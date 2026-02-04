from flask import Flask, jsonify, send_from_directory
from pathlib import Path
import random

BASE_DIR = Path(__file__).resolve().parent          # .../miniapp/backend
FRONTEND_DIR = (BASE_DIR / ".." / "frontend").resolve()

app = Flask(__name__)

# ---------- API (заглушки) ----------
@app.get("/api/user")
def api_user():
    # Заглушки
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

@app.get("/static/<path:filename>")
def static_files(filename: str):
    # раздаём ВСЮ статику строго из frontend/
    return send_from_directory(FRONTEND_DIR, filename)

def sanity_check_paths():
    if not FRONTEND_DIR.exists():
        raise RuntimeError(f"FRONTEND_DIR not found: {FRONTEND_DIR}")
    for f in ["index.html", "styles.css", "app.js"]:
        p = FRONTEND_DIR / f
        if not p.exists():
            raise RuntimeError(f"Missing file: {p}")

if __name__ == "__main__":
    sanity_check_paths()
    # Важно: оставь 127.0.0.1 если прокси рядом, либо 0.0.0.0 если тестишь из сети напрямую
    app.run(host="127.0.0.1", port=8000, debug=True)
