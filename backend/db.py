import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta

from config import DB_PATH

@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_conn() as conn:
        c = conn.cursor()

        c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tg_user_id INTEGER UNIQUE NOT NULL,
            first_name TEXT,
            username TEXT,
            role TEXT NOT NULL CHECK(role IN ('admin','user')),
            balance_rub REAL NOT NULL DEFAULT 0,
            tariff_id INTEGER,
            created_at TEXT NOT NULL
        )
        """)

        c.execute("""
        CREATE TABLE IF NOT EXISTS invites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin','user')),
            is_used INTEGER NOT NULL DEFAULT 0,
            used_by_tg_id INTEGER,
            used_at TEXT
        )
        """)

        c.execute("""
        CREATE TABLE IF NOT EXISTS user_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tg_user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            config_text TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY(tg_user_id) REFERENCES users(tg_user_id)
        )
        """)

        conn.commit()

def upsert_user(tg_user_id: int, first_name: str, username: str, role: str, balance: float, tariff_id: int):
    now = datetime.utcnow().isoformat()
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("""
        INSERT INTO users(tg_user_id, first_name, username, role, balance_rub, tariff_id, created_at)
        VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(tg_user_id) DO UPDATE SET
          first_name=excluded.first_name,
          username=excluded.username,
          role=excluded.role,
          balance_rub=excluded.balance_rub,
          tariff_id=excluded.tariff_id
        """, (tg_user_id, first_name, username, role, float(balance), int(tariff_id), now))
        conn.commit()

def get_user_by_tg_id(tg_user_id: int):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE tg_user_id=?", (tg_user_id,))
        return c.fetchone()

def list_users():
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users ORDER BY role DESC, tg_user_id ASC")
        return c.fetchall()

def set_user_balance(tg_user_id: int, balance: float):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET balance_rub=? WHERE tg_user_id=?", (float(balance), tg_user_id))
        conn.commit()

def set_user_tariff(tg_user_id: int, tariff_id: int):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET tariff_id=? WHERE tg_user_id=?", (int(tariff_id), tg_user_id))
        conn.commit()

def delete_user(tg_user_id: int):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM user_configs WHERE tg_user_id=?", (tg_user_id,))
        c.execute("DELETE FROM users WHERE tg_user_id=?", (tg_user_id,))
        conn.commit()

def list_configs(tg_user_id: int):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM user_configs WHERE tg_user_id=? ORDER BY id DESC", (tg_user_id,))
        return c.fetchall()

def add_config(tg_user_id: int, title: str, config_text: str):
    now = datetime.utcnow().isoformat()
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("""
        INSERT INTO user_configs(tg_user_id, title, config_text, is_active, created_at)
        VALUES(?,?,?,?,?)
        """, (tg_user_id, title, config_text, 1, now))
        conn.commit()

def update_config(config_id: int, tg_user_id: int, title: str, config_text: str, is_active: int):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("""
        UPDATE user_configs
        SET title=?, config_text=?, is_active=?
        WHERE id=? AND tg_user_id=?
        """, (title, config_text, int(is_active), int(config_id), int(tg_user_id)))
        conn.commit()
        return c.rowcount  # важно для отладки

def delete_config(config_id: int, tg_user_id: int):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM user_configs WHERE id=? AND tg_user_id=?", (int(config_id), int(tg_user_id)))
        conn.commit()
        return c.rowcount

def create_invite(code: str, role: str):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("INSERT INTO invites(code, role, is_used) VALUES(?,?,0)", (code, role))
        conn.commit()

def redeem_invite(code: str, used_by_tg_id: int):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM invites WHERE code=? AND is_used=0", (code,))
        row = c.fetchone()
        if not row:
            return None
        c.execute("""
        UPDATE invites SET is_used=1, used_by_tg_id=?, used_at=?
        WHERE id=?
        """, (used_by_tg_id, datetime.utcnow().isoformat(), row["id"]))
        conn.commit()
        return row
