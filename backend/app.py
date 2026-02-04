from flask import Flask, jsonify, send_from_directory
from pathlib import Path
import random

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = (BASE_DIR / ".." / "frontend").resolve()

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path=""   # раздаём статику прямо из корня: /styles.css, /app.js
)

# ---------- API (заглушки) ----------
@app.route("/api/user")
def user():
    return jsonify({
        "balance": round(random.uniform(100, 500), 2),
        "tariff": "Basic",
        "next_charge": "01.01.2026"
    })

@app.route("/api/vpn")
def vpn_list():
    return jsonify([
        {
            "name": "Germany #1",
            "status": "online",
            "expires": "2026-03-01",
            "config": "vless://TEST@de1.example.com:443?security=tls&type=ws#Germany%20%231"
        }
    ])

# ---------- Frontend ----------
@app.route("/")
def index():
    return send_from_directory(str(FRONTEND_DIR), "index.html")

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
