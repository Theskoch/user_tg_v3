import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import secrets
import string

from config import DB_PATH, ZERO_TG_USER_ID, ZERO_NAME

def get_conn() -> sqlite3.Connection:
    db_file = Path(DB_PATH)
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_file), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()

    # users
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tg_user_id INTEGER UNIQUE NOT NULL,
        first_name TEXT,
        last_name TEXT,
        username TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        role TEXT NOT NULL DEFAULT 'user', -- 'admin'|'user'
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    """)

    # balances
    cur.execute("""
    CREATE TABLE IF NOT EXISTS balances (
        user_id INTEGER PRIMARY KEY,
        balance_rub REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # subscriptions
    cur.execute("""
    CREATE TABLE IF NOT EXISTS subscriptions (
        user_id INTEGER PRIMARY KEY,
        tariff_name TEXT NOT NULL DEFAULT 'Basic',
        tariff_price_rub INTEGER NOT NULL DEFAULT 150,
        tariff_period_months INTEGER NOT NULL DEFAULT 1,
        paid_at TEXT NOT NULL DEFAULT '2026-01-01',      -- заглушка, позже будем менять
        expires_at TEXT NOT NULL DEFAULT '2026-02-01',   -- рассчитываем от paid_at
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # invite codes
    cur.execute("""
    CREATE TABLE IF NOT EXISTS invites (
        code TEXT PRIMARY KEY,
        role TEXT NOT NULL,                -- 'admin' or 'user'
        created_by_user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        used_by_user_id INTEGER,
        used_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id),
        FOREIGN KEY (used_by_user_id) REFERENCES users(id)
    );
    """)

    # vpn configs
    cur.execute("""
    CREATE TABLE IF NOT EXISTS vpn_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        config_text TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()

def _ensure_balance_and_sub(cur, user_id: int) -> None:
    cur.execute("""
    INSERT INTO balances (user_id, balance_rub)
    VALUES (?, 0)
    ON CONFLICT(user_id) DO NOTHING
    """, (user_id,))

    cur.execute("""
    INSERT INTO subscriptions (user_id, tariff_name, tariff_price_rub, tariff_period_months, paid_at, expires_at)
    VALUES (?, 'Basic', 150, 1, '2026-01-01', '2026-02-01')
    ON CONFLICT(user_id) DO NOTHING
    """, (user_id,))

def create_zero_user() -> None:
    if not ZERO_TG_USER_ID:
        return

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO users (tg_user_id, first_name, is_active, role)
    VALUES (?, ?, 1, 'admin')
    ON CONFLICT(tg_user_id) DO UPDATE SET
        first_name=excluded.first_name,
        is_active=1,
        role='admin'
    """, (ZERO_TG_USER_ID, ZERO_NAME))

    cur.execute("SELECT id FROM users WHERE tg_user_id = ?", (ZERO_TG_USER_ID,))
    row = cur.fetchone()
    if row:
        _ensure_balance_and_sub(cur, int(row["id"]))

    conn.commit()
    conn.close()

def upsert_user_from_tg(tg_user: Dict[str, Any]) -> int:
    """
    Обновляет first_name/last_name/username у существующего пользователя.
    НЕ создаёт новых пользователей "в обход" (создание идёт через invite).
    Возвращает internal user_id.
    """
    tg_user_id = int(tg_user["id"])
    first_name = tg_user.get("first_name")
    last_name = tg_user.get("last_name")
    username = tg_user.get("username")

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id FROM users WHERE tg_user_id = ?", (tg_user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise KeyError("User not registered")

    cur.execute("""
    UPDATE users
    SET first_name=?, last_name=?, username=?
    WHERE tg_user_id=?
    """, (first_name, last_name, username, tg_user_id))

    user_id = int(row["id"])
    _ensure_balance_and_sub(cur, user_id)

    conn.commit()
    conn.close()
    return user_id

def get_user_by_tg_id(tg_user_id: int) -> Optional[sqlite3.Row]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE tg_user_id = ?", (int(tg_user_id),))
    row = cur.fetchone()
    conn.close()
    return row

def is_user_allowed(tg_user_id: int) -> bool:
    row = get_user_by_tg_id(tg_user_id)
    return bool(row and int(row["is_active"]) == 1)

def is_admin(tg_user_id: int) -> bool:
    row = get_user_by_tg_id(tg_user_id)
    return bool(row and row["role"] == "admin" and int(row["is_active"]) == 1)

def get_user_payload(tg_user_id: int) -> Dict[str, Any]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
    SELECT u.tg_user_id, u.first_name, u.last_name, u.username, u.role,
           b.balance_rub,
           s.tariff_name, s.tariff_price_rub, s.tariff_period_months, s.paid_at, s.expires_at
    FROM users u
    LEFT JOIN balances b ON b.user_id = u.id
    LEFT JOIN subscriptions s ON s.user_id = u.id
    WHERE u.tg_user_id = ?
    """, (int(tg_user_id),))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise KeyError("User not found")

    return {
        "tg_user_id": int(row["tg_user_id"]),
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "username": row["username"],
        "role": row["role"],
        "balance_rub": float(row["balance_rub"] or 0),
        "tariff": {
            "name": row["tariff_name"] or "Basic",
            "price_rub": int(row["tariff_price_rub"] or 150),
            "period_months": int(row["tariff_period_months"] or 1),
            "paid_at": row["paid_at"] or "2026-01-01",
            "expires_at": row["expires_at"] or "2026-02-01",
        }
    }

# ---------- Invites ----------
_ALPHABET = string.ascii_letters + string.digits  # mixed case + digits

def generate_invite_code(length: int = 32) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))

def create_invite(created_by_tg_id: int, role: str) -> str:
    if role not in ("admin", "user"):
        raise ValueError("bad role")

    creator = get_user_by_tg_id(created_by_tg_id)
    if not creator:
        raise KeyError("creator not found")

    code = generate_invite_code(32)

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
    INSERT INTO invites (code, role, created_by_user_id, is_active)
    VALUES (?, ?, ?, 1)
    """, (code, role, int(creator["id"])))
    conn.commit()
    conn.close()
    return code

def redeem_invite(tg_user: Dict[str, Any], code: str) -> None:
    """
    Если код валиден и активен — создаём пользователя (или активируем) с нужной ролью,
    отмечаем код использованным.
    """
    code = (code or "").strip()
    if not code:
        raise ValueError("empty code")

    tg_user_id = int(tg_user["id"])
    first_name = tg_user.get("first_name")
    last_name = tg_user.get("last_name")
    username = tg_user.get("username")

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT * FROM invites WHERE code=? AND is_active=1 AND used_at IS NULL", (code,))
    inv = cur.fetchone()
    if not inv:
        conn.close()
        raise KeyError("invalid invite")

    role = inv["role"]

    # upsert user
    cur.execute("""
    INSERT INTO users (tg_user_id, first_name, last_name, username, is_active, role)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(tg_user_id) DO UPDATE SET
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      username=excluded.username,
      is_active=1,
      role=excluded.role
    """, (tg_user_id, first_name, last_name, username, role))

    cur.execute("SELECT id FROM users WHERE tg_user_id=?", (tg_user_id,))
    u = cur.fetchone()
    if not u:
        conn.close()
        raise RuntimeError("failed to create user")

    user_id = int(u["id"])
    _ensure_balance_and_sub(cur, user_id)

    cur.execute("""
    UPDATE invites
    SET used_by_user_id=?, used_at=datetime('now'), is_active=0
    WHERE code=?
    """, (user_id, code))

    conn.commit()
    conn.close()

# ---------- Admin: users ----------
def admin_list_users() -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
    SELECT u.id, u.tg_user_id, u.first_name, u.last_name, u.username, u.role, u.is_active,
           b.balance_rub,
           s.tariff_name, s.tariff_price_rub, s.tariff_period_months, s.expires_at
    FROM users u
    LEFT JOIN balances b ON b.user_id = u.id
    LEFT JOIN subscriptions s ON s.user_id = u.id
    ORDER BY u.id DESC
    """)
    rows = cur.fetchall()
    conn.close()
    out = []
    for r in rows:
        out.append({
            "tg_user_id": int(r["tg_user_id"]),
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "username": r["username"],
            "role": r["role"],
            "is_active": int(r["is_active"]),
            "balance_rub": float(r["balance_rub"] or 0),
            "tariff_name": r["tariff_name"] or "Basic",
            "tariff_price_rub": int(r["tariff_price_rub"] or 150),
            "tariff_period_months": int(r["tariff_period_months"] or 1),
            "expires_at": r["expires_at"] or "2026-02-01",
        })
    return out

def admin_set_balance(target_tg_user_id: int, new_balance_rub: float) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE tg_user_id=?", (int(target_tg_user_id),))
    u = cur.fetchone()
    if not u:
        conn.close()
        raise KeyError("user not found")
    user_id = int(u["id"])
    cur.execute("""
    INSERT INTO balances (user_id, balance_rub)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET balance_rub=excluded.balance_rub
    """, (user_id, float(new_balance_rub)))
    conn.commit()
    conn.close()

def admin_set_tariff(target_tg_user_id: int, name: str, price_rub: int, period_months: int) -> None:
    """
    При изменении тарифа обновляем expires_at относительно paid_at.
    paid_at пока заглушка в БД (позже начнёте менять).
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE tg_user_id=?", (int(target_tg_user_id),))
    u = cur.fetchone()
    if not u:
        conn.close()
        raise KeyError("user not found")
    user_id = int(u["id"])

    cur.execute("SELECT paid_at FROM subscriptions WHERE user_id=?", (user_id,))
    s = cur.fetchone()
    paid_at = (s["paid_at"] if s else "2026-01-01") or "2026-01-01"

    # paid_at: YYYY-MM-DD
    dt = datetime.strptime(paid_at, "%Y-%m-%d")
    # месяц считаем грубо: +30 дней * months (заглушка, потом сделаем нормально календарно)
    expires = dt + timedelta(days=30 * int(period_months))
    expires_at = expires.strftime("%Y-%m-%d")

    cur.execute("""
    INSERT INTO subscriptions (user_id, tariff_name, tariff_price_rub, tariff_period_months, paid_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
        tariff_name=excluded.tariff_name,
        tariff_price_rub=excluded.tariff_price_rub,
        tariff_period_months=excluded.tariff_period_months,
        expires_at=excluded.expires_at
    """, (user_id, name, int(price_rub), int(period_months), paid_at, expires_at))

    conn.commit()
    conn.close()

def admin_delete_user(target_tg_user_id: int) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE tg_user_id=?", (int(target_tg_user_id),))
    conn.commit()
    conn.close()

# ---------- Admin: configs ----------
def admin_list_configs(target_tg_user_id: int) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE tg_user_id=?", (int(target_tg_user_id),))
    u = cur.fetchone()
    if not u:
        conn.close()
        raise KeyError("user not found")
    user_id = int(u["id"])

    cur.execute("""
    SELECT id, title, config_text, is_active, created_at
    FROM vpn_configs
    WHERE user_id=?
    ORDER BY id DESC
    """, (user_id,))
    rows = cur.fetchall()
    conn.close()

    return [{
        "id": int(r["id"]),
        "title": r["title"],
        "config_text": r["config_text"],
        "is_active": int(r["is_active"]),
        "created_at": r["created_at"],
    } for r in rows]

def admin_add_config(target_tg_user_id: int, title: str, config_text: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE tg_user_id=?", (int(target_tg_user_id),))
    u = cur.fetchone()
    if not u:
        conn.close()
        raise KeyError("user not found")
    user_id = int(u["id"])

    cur.execute("""
    INSERT INTO vpn_configs (user_id, title, config_text, is_active)
    VALUES (?, ?, ?, 1)
    """, (user_id, title.strip() or "Config", config_text.strip()))
    conn.commit()
    conn.close()

def admin_update_config(config_id: int, title: str, config_text: str, is_active: int) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
    UPDATE vpn_configs
    SET title=?, config_text=?, is_active=?
    WHERE id=?
    """, (title.strip() or "Config", config_text.strip(), int(is_active), int(config_id)))
    conn.commit()
    conn.close()

def admin_delete_config(config_id: int) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM vpn_configs WHERE id=?", (int(config_id),))
    conn.commit()
    conn.close()
