import sqlite3
from pathlib import Path
from typing import Optional, Dict, Any, List

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

    # Пользователи
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tg_user_id INTEGER UNIQUE NOT NULL,
        first_name TEXT,
        last_name TEXT,
        username TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_admin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    """)

    # Платёжка/баланс (пока примитив)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS balances (
        user_id INTEGER PRIMARY KEY,
        balance_rub REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    """)

    # Тариф (пока одна запись на пользователя)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS subscriptions (
        user_id INTEGER PRIMARY KEY,
        tariff_name TEXT NOT NULL DEFAULT 'Basic',
        tariff_price_text TEXT NOT NULL DEFAULT '150 ₽/мес',
        next_charge TEXT NOT NULL DEFAULT '01.01.2026',
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    """)

    conn.commit()
    conn.close()

def create_zero_user() -> None:
    """
    Создаёт нулевого пользователя (seed/admin) если задан ZERO_TG_USER_ID.
    """
    if not ZERO_TG_USER_ID:
        return

    conn = get_conn()
    cur = conn.cursor()

    # upsert user
    cur.execute("""
    INSERT INTO users (tg_user_id, first_name, is_admin, is_active)
    VALUES (?, ?, 1, 1)
    ON CONFLICT(tg_user_id) DO UPDATE SET
        first_name=excluded.first_name,
        is_admin=1,
        is_active=1
    """, (ZERO_TG_USER_ID, ZERO_NAME))

    # связанный user_id
    cur.execute("SELECT id FROM users WHERE tg_user_id = ?", (ZERO_TG_USER_ID,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return

    user_id = int(row["id"])

    # баланс и подписка (если нет — создаём)
    cur.execute("""
    INSERT INTO balances (user_id, balance_rub)
    VALUES (?, 325.50)
    ON CONFLICT(user_id) DO NOTHING
    """, (user_id,))

    cur.execute("""
    INSERT INTO subscriptions (user_id, tariff_name, tariff_price_text, next_charge)
    VALUES (?, 'Basic', '150 ₽/мес', '01.01.2026')
    ON CONFLICT(user_id) DO NOTHING
    """, (user_id,))

    conn.commit()
    conn.close()

def upsert_user_from_tg(tg_user: Dict[str, Any]) -> int:
    """
    Создаёт/обновляет пользователя из Telegram и возвращает internal user_id.
    """
    tg_user_id = int(tg_user["id"])
    first_name = tg_user.get("first_name")
    last_name = tg_user.get("last_name")
    username = tg_user.get("username")

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO users (tg_user_id, first_name, last_name, username, is_active, is_admin)
    VALUES (?, ?, ?, ?, 1, 0)
    ON CONFLICT(tg_user_id) DO UPDATE SET
        first_name=excluded.first_name,
        last_name=excluded.last_name,
        username=excluded.username
    """, (tg_user_id, first_name, last_name, username))

    cur.execute("SELECT id FROM users WHERE tg_user_id = ?", (tg_user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise RuntimeError("Failed to fetch user after upsert")

    user_id = int(row["id"])

    # гарантируем строки баланса/подписки
    cur.execute("""
    INSERT INTO balances (user_id, balance_rub)
    VALUES (?, 0)
    ON CONFLICT(user_id) DO NOTHING
    """, (user_id,))

    cur.execute("""
    INSERT INTO subscriptions (user_id, tariff_name, tariff_price_text, next_charge)
    VALUES (?, 'Basic', '150 ₽/мес', '01.01.2026')
    ON CONFLICT(user_id) DO NOTHING
    """, (user_id,))

    conn.commit()
    conn.close()
    return user_id

def is_user_allowed(tg_user_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT is_active FROM users WHERE tg_user_id = ?", (int(tg_user_id),))
    row = cur.fetchone()
    conn.close()
    return bool(row and int(row["is_active"]) == 1)

def get_user_payload(tg_user_id: int) -> Dict[str, Any]:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    SELECT u.id as user_id, b.balance_rub, s.tariff_name, s.tariff_price_text, s.next_charge
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
        "balance_rub": float(row["balance_rub"] or 0),
        "tariff_name": row["tariff_name"] or "Basic",
        "tariff_price_text": row["tariff_price_text"] or "150 ₽/мес",
        "next_charge": row["next_charge"] or "01.01.2026",
    }
