#!/usr/bin/env python3
"""
Красивая серверная консоль — запускай прямо на сервере:
    cd /path/to/backend
    python server_console.py

Зависимости (уже есть в проекте или ставятся):
    pip install rich psutil
"""

import os
import sys
import time
import sqlite3
from datetime import datetime
from collections import deque

import psutil
from rich import box
from rich.align import Align
from rich.columns import Columns
from rich.console import Console
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.progress import BarColumn, Progress, TextColumn
from rich.table import Table
from rich.text import Text

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
REFRESH   = 5   # seconds between updates


def _resolve_log_path() -> str:
    """Find the log file.

    Priority:
    1. LOG_PATH environment variable
    2. LOG_PATH in .env file
    3. /data/auth_debug.log  (Docker default)
    4. backend/auth_debug.log (local fallback)
    """
    # 1. Env var
    env_val = os.environ.get('LOG_PATH', '')
    if env_val:
        return env_val

    # 2. .env file
    for ef in [os.path.join(BASE_DIR, '..', '.env'), os.path.join(BASE_DIR, '.env')]:
        if os.path.exists(ef):
            with open(ef) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('LOG_PATH='):
                        val = line.split('=', 1)[1].strip().strip('"').strip("'")
                        if val:
                            return val

    # 3 & 4. Common paths
    for candidate in ['/data/auth_debug.log', os.path.join(BASE_DIR, 'auth_debug.log')]:
        if os.path.exists(candidate):
            return candidate

    return os.path.join(BASE_DIR, 'auth_debug.log')


LOG_PATH = _resolve_log_path()
LOG_LINES = 18  # lines shown in the log panel

console = Console()


def _parse_sqlite_path(url: str) -> str | None:
    """Extract file path from a sqlite:/// URL."""
    if not url.startswith('sqlite:///'):
        return None
    path = url[len('sqlite:///'):]   # e.g. '/data/users.db' or 'users.db'
    if not os.path.isabs(path):
        path = os.path.join(BASE_DIR, path)
    return path


def _resolve_db_path() -> str:
    """Find the SQLite database file.

    Priority:
    1. DATABASE_URL environment variable  (set by Docker / shell)
    2. DATABASE_URL in .env file          (local non-Docker runs)
    3. backend/instance/users.db          (Flask default instance folder)
    4. backend/users.db                   (flat layout fallback)
    """
    # 1. Env var (Docker passes variables directly, no file needed)
    env_url = os.environ.get('DATABASE_URL', '')
    if env_url:
        p = _parse_sqlite_path(env_url)
        if p:
            return p

    # 2. .env file (for running the script outside Docker)
    env_file = os.path.join(BASE_DIR, '..', '.env')   # project root .env
    for ef in [env_file, os.path.join(BASE_DIR, '.env')]:
        if os.path.exists(ef):
            with open(ef) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('DATABASE_URL='):
                        val = line.split('=', 1)[1].strip().strip('"').strip("'")
                        p = _parse_sqlite_path(val)
                        if p and os.path.exists(p):
                            return p

    # 3 & 4. Common paths
    for candidate in [
        os.path.join(BASE_DIR, 'instance', 'users.db'),
        os.path.join(BASE_DIR, 'users.db'),
        '/data/users.db',
    ]:
        if os.path.exists(candidate):
            return candidate

    return os.path.join(BASE_DIR, 'instance', 'users.db')


DB_PATH = _resolve_db_path()


# ── Database helpers ──────────────────────────────────────────────────────────

def db_query(sql, params=()):
    """Run a read-only SQLite query, return list of Row objects."""
    try:
        conn = sqlite3.connect(f'file:{DB_PATH}?mode=ro', uri=True)
        conn.row_factory = sqlite3.Row
        cur = conn.execute(sql, params)
        rows = cur.fetchall()
        conn.close()
        return rows
    except Exception:
        return []


def _one(sql, params=()):
    """Return the integer value of the first column of the first row."""
    rows = db_query(sql, params)
    return rows[0][0] if rows else 0


def get_app_stats():
    # Table names from db.py __tablename__ attributes:
    #   User        → users
    #   ConfigItem  → configs
    #   TopUpTicket → topup_tickets
    users   = _one("SELECT COUNT(*) FROM users")
    configs = _one("SELECT COUNT(*) FROM configs")
    pending = _one("SELECT COUNT(*) FROM topup_tickets WHERE status='pending'")
    return users, configs, pending


def get_recent_topups(n=8):
    return db_query(
        """
        SELECT t.amount, t.status, t.created_at,
               u.first_name, u.username
        FROM   topup_tickets t
        LEFT   JOIN users u ON u.id = t.user_id
        ORDER  BY t.created_at DESC
        LIMIT  ?
        """,
        (n,)
    )


# ── Log tail ──────────────────────────────────────────────────────────────────

_log_buf: deque = deque(maxlen=LOG_LINES)

def refresh_log():
    try:
        with open(LOG_PATH, 'r', encoding='utf-8', errors='replace') as f:
            for line in f:
                pass   # fast-forward to end on first open
        # tail last N lines
        with open(LOG_PATH, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
        _log_buf.clear()
        _log_buf.extend(lines[-LOG_LINES:])
    except FileNotFoundError:
        _log_buf.append("(лог-файл не найден)\n")
    except Exception as e:
        _log_buf.append(f"(ошибка чтения лога: {e})\n")


# ── Rendering helpers ─────────────────────────────────────────────────────────

def colour_for(pct: float) -> str:
    if pct < 60:  return "green"
    if pct < 85:  return "yellow"
    return "red"


def fmt_uptime(sec: int) -> str:
    d, rem = divmod(sec, 86400)
    h, rem = divmod(rem, 3600)
    m      = rem // 60
    if d:  return f"{d}д {h}ч {m}м"
    if h:  return f"{h}ч {m}м"
    return f"{m}м"


def make_metrics_panel() -> Panel:
    cpu   = psutil.cpu_percent(interval=0)
    ram   = psutil.virtual_memory()
    disk  = psutil.disk_usage('/')
    uptime = int(time.time() - psutil.boot_time())

    prog = Progress(
        TextColumn("{task.description}", style="bold white", justify="right"),
        BarColumn(bar_width=28, style="green", complete_style="green"),
        TextColumn("{task.percentage:>5.1f}%", style="bold"),
        expand=False,
    )
    def add(label, pct):
        c = colour_for(pct)
        t = prog.add_task(label, total=100, completed=pct)
        prog.columns[1].style         = c   # type: ignore[attr-defined]
        prog.columns[1].complete_style = c  # type: ignore[attr-defined]

    cpu_task  = prog.add_task("[cyan]CPU      ", total=100, completed=cpu)
    ram_task  = prog.add_task(f"[cyan]RAM  {ram.used//1024//1024:>5}M/{ram.total//1024//1024}M", total=100, completed=ram.percent)
    disk_task = prog.add_task(f"[cyan]Диск {disk.used//1024**3:>4.0f}G/{disk.total//1024**3:.0f}G", total=100, completed=disk.percent)

    table = Table.grid(padding=(0, 2))
    table.add_column()
    table.add_column()
    table.add_row(prog, Text(f"⏱  Uptime: {fmt_uptime(uptime)}", style="dim"))

    return Panel(table, title="[bold]🖥  Сервер", border_style="blue", box=box.ROUNDED)


def make_app_stats_panel(users, configs, pending) -> Panel:
    t = Table.grid(expand=True, padding=(0, 3))
    t.add_column(justify="center")
    t.add_column(justify="center")
    t.add_column(justify="center")

    t.add_row(
        Text(str(users),   style="bold bright_white", justify="center"),
        Text(str(configs), style="bold bright_white", justify="center"),
        Text(str(pending), style="bold " + ("yellow" if pending else "bright_white"), justify="center"),
    )
    t.add_row(
        Text("Пользователи", style="dim", justify="center"),
        Text("Конфиги",      style="dim", justify="center"),
        Text("Ожидают",      style="dim " + ("yellow" if pending else ""), justify="center"),
    )

    return Panel(t, title="[bold]📊  Приложение", border_style="blue", box=box.ROUNDED)


def make_topups_panel(rows) -> Panel:
    t = Table(box=box.SIMPLE_HEAVY, show_header=True, header_style="bold dim",
              expand=True, show_lines=False)
    t.add_column("Сумма",    style="bold", width=10)
    t.add_column("Статус",   width=10)
    t.add_column("Кто",      style="dim",  min_width=14)
    t.add_column("Когда",    style="dim",  width=17, justify="right")

    status_style = {"pending": "yellow", "approved": "green", "rejected": "red"}
    status_label = {"pending": "⏳ ожидает", "approved": "✅ принят", "rejected": "❌ отклонён"}

    for r in rows:
        st = r["status"] or "pending"
        user = f"{r['first_name'] or ''} @{r['username'] or ''}".strip() or "—"
        ts = r["created_at"] or ""
        try:
            dt = datetime.fromisoformat(ts.replace("Z",""))
            ts = dt.strftime("%d.%m  %H:%M")
        except Exception:
            ts = ts[:16]
        t.add_row(
            f"{float(r['amount']):.2f} ₽",
            Text(status_label.get(st, st), style=status_style.get(st, "")),
            user,
            ts,
        )

    if not rows:
        t.add_row("—", "—", "—", "—")

    return Panel(t, title="[bold]💳  Последние пополнения", border_style="blue", box=box.ROUNDED)


def make_log_panel() -> Panel:
    text = Text()
    for raw_line in _log_buf:
        line = raw_line.rstrip("\n")
        lower = line.lower()
        if "error" in lower or "fail" in lower or "exception" in lower:
            style = "red"
        elif "warn" in lower or "hmac_failed" in lower:
            style = "yellow"
        else:
            style = "dim green"
        text.append(line + "\n", style=style)

    now = datetime.utcnow().strftime("%H:%M:%S UTC")
    return Panel(
        text,
        title=f"[bold]📜  Лог  [dim](обновлено {now})",
        border_style="blue",
        box=box.ROUNDED,
    )


def make_header() -> Panel:
    grid = Table.grid(expand=True)
    grid.add_column()
    grid.add_column(justify="right")
    grid.add_row(
        Text("VPN Admin Console", style="bold bright_white"),
        Text(datetime.now().strftime("%Y-%m-%d  %H:%M:%S"), style="dim"),
    )
    return Panel(grid, style="on dark_blue", box=box.ROUNDED)


# ── Main loop ─────────────────────────────────────────────────────────────────

def build_layout() -> Layout:
    layout = Layout()
    layout.split_column(
        Layout(name="header",  size=3),
        Layout(name="top",     size=10),
        Layout(name="middle",  size=14),
        Layout(name="log"),
    )
    layout["top"].split_row(
        Layout(name="metrics", ratio=3),
        Layout(name="stats",   ratio=2),
    )
    return layout


def main():
    refresh_log()
    layout = build_layout()
    psutil.cpu_percent(interval=None)   # prime the measurement

    with Live(layout, refresh_per_second=1, screen=True) as live:
        while True:
            try:
                cpu_now = psutil.cpu_percent(interval=0)
                users, configs, pending = get_app_stats()
                topups = get_recent_topups()
                refresh_log()

                layout["header"].update(make_header())
                layout["metrics"].update(make_metrics_panel())
                layout["stats"].update(make_app_stats_panel(users, configs, pending))
                layout["middle"].update(make_topups_panel(topups))
                layout["log"].update(make_log_panel())

            except KeyboardInterrupt:
                break
            except Exception as e:
                layout["header"].update(Panel(f"[red]Ошибка: {e}", box=box.ROUNDED))

            time.sleep(REFRESH)


if __name__ == "__main__":
    try:
        import rich
    except ImportError:
        print("Установи rich:  pip install rich psutil")
        sys.exit(1)

    # Show resolved paths before entering full-screen mode
    db_ok  = "✅" if os.path.exists(DB_PATH)  else "❌ НЕ НАЙДЕН"
    log_ok = "✅" if os.path.exists(LOG_PATH) else "⚠️  не найден (логи пустые)"
    print(f"DB  : {DB_PATH}  {db_ok}")
    print(f"LOG : {LOG_PATH}  {log_ok}")
    if not os.path.exists(DB_PATH):
        print("\nБД не найдена. Укажи путь вручную:")
        print("  DATABASE_URL=sqlite:////абсолютный/путь/users.db python server_console.py")
        sys.exit(1)
    time.sleep(1)
    main()
