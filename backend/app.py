from flask import Flask, jsonify, send_from_directory
import random

app = Flask(__name__, static_folder="../frontend")

# ---------- API ----------

@app.route("/api/user")
def user():
    return jsonify({
        "balance": round(random.uniform(3, 25), 2),
        "tariff": "Premium",
        "avatar_letter": "U"
    })


@app.route("/api/vpn")
def vpn_list():
    return jsonify([
        {
            "name": "Germany #1",
            "status": "online",
            "expires": "2026-03-01"
        },
        {
            "name": "Netherlands #2",
            "status": "offline",
            "expires": "2026-02-15"
        },
        {
            "name": "Finland #1",
            "status": "online",
            "expires": "2026-04-10"
        }
    ])


# ---------- Frontend ----------

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(app.static_folder, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
