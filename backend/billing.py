import os
import json
import time
import threading
from datetime import datetime, timedelta

from utils import add_months, send_bot_message, notify_admins_topup, log_auth

TARIFFS_PATH = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'tariffs.json')


def load_tariffs():
    try:
        with open(TARIFFS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f).get('tariffs', [])
    except Exception:
        return []


def run_billing_cycle():
    from db import db, User, TopUpTicket

    tariffs = {t['id']: t for t in load_tariffs()}
    now = datetime.utcnow()
    now_msk = now + timedelta(hours=3)
    today_msk = now_msk.date()
    is_noon_msk = now_msk.time().hour == 12
    is_11_msk = now_msk.time().hour == 11
    admins = User.query.filter_by(is_admin=True).all()

    def fmt_dt(dt_val):
        return dt_val.strftime('%d.%m.%Y') if dt_val else '—'

    def days_left(target_dt):
        if not target_dt:
            return None
        return (target_dt.date() - today_msk).days

    def send_admins(text):
        for admin in admins:
            send_bot_message(admin.telegram_id, text)

    for user in User.query.filter(User.tariff_id.isnot(None)).all():
        tariff = tariffs.get(user.tariff_id)
        if not tariff:
            continue

        price = float(tariff.get('price_rub') or 0)
        months = int(tariff.get('period_months') or 1)

        if not user.tariff_next_charge_at:
            user.tariff_next_charge_at = now
        if not user.tariff_paid_until:
            user.tariff_paid_until = user.tariff_next_charge_at

        # Reminders before charge date: 14 / 7 / 0 days
        if user.balance < price:
            left_days = days_left(user.tariff_next_charge_at)
            if left_days is not None:
                if left_days == 14 and (not user.user_warn_14_at or user.user_warn_14_at.date() != today_msk):
                    send_bot_message(user.telegram_id, (
                        f"Напоминание: до оплаты тарифа осталось {left_days} дней. "
                        f"Дата оплаты: {fmt_dt(user.tariff_next_charge_at)}. "
                        f"Для продления тарифа «{tariff.get('name')}» нужно {price:.2f} ₽."
                    ))
                    user.user_warn_14_at = now
                if left_days == 7 and (not user.user_warn_7_at or user.user_warn_7_at.date() != today_msk):
                    send_bot_message(user.telegram_id, (
                        f"Напоминание: до оплаты тарифа осталось {left_days} дней. "
                        f"Дата оплаты: {fmt_dt(user.tariff_next_charge_at)}. "
                        f"Для продления тарифа «{tariff.get('name')}» нужно {price:.2f} ₽."
                    ))
                    user.user_warn_7_at = now
                if left_days == 0 and (not user.user_warn_0_at or user.user_warn_0_at.date() != today_msk):
                    send_bot_message(user.telegram_id, (
                        f"Сегодня последний день оплаты тарифа. "
                        f"Дата оплаты: {fmt_dt(user.tariff_next_charge_at)}. "
                        f"Для продления тарифа «{tariff.get('name')}» нужно {price:.2f} ₽."
                    ))
                    user.user_warn_0_at = now

        # Admin notice on due date
        if user.balance < price and user.tariff_next_charge_at:
            left_days = days_left(user.tariff_next_charge_at)
            if left_days == 0 and (not user.admin_warn_0_at or user.admin_warn_0_at.date() != today_msk):
                send_admins(
                    f"Тариф пользователя {user.first_name or ''} @{user.username or ''} закончился сегодня. "
                    f"Дата оплаты: {fmt_dt(user.tariff_next_charge_at)}."
                )
                user.admin_warn_0_at = now

        # Charge if due
        if user.tariff_next_charge_at and now >= user.tariff_next_charge_at:
            if user.balance >= price:
                user.balance -= price
                user.tariff_paid_until = add_months(user.tariff_next_charge_at, months)
                user.tariff_next_charge_at = user.tariff_paid_until
                user.last_overdue_admin_at = None
            else:
                overdue_days = (today_msk - user.tariff_next_charge_at.date()).days

                # Daily reminders after overdue (up to 14 days) at 12:00 MSK
                if 1 <= overdue_days <= 14 and is_noon_msk:
                    if not user.user_overdue_daily_at or user.user_overdue_daily_at.date() != today_msk:
                        block_date = user.tariff_next_charge_at.date() + timedelta(days=14)
                        send_bot_message(user.telegram_id, (
                            f"Тариф просрочен на {overdue_days} дней. "
                            f"Оплатите до {block_date.strftime('%d.%m.%Y')}, иначе доступ будет заблокирован."
                        ))
                        user.user_overdue_daily_at = now

                # Admin notices at +7 and +14 days
                if overdue_days == 7 and is_11_msk and (not user.admin_warn_7_at or user.admin_warn_7_at.date() != today_msk):
                    send_admins(
                        f"Пользователь {user.first_name or ''} @{user.username or ''} не оплатил тариф уже 7 дней. "
                        f"Дата оплаты: {fmt_dt(user.tariff_next_charge_at)}."
                    )
                    user.admin_warn_7_at = now

                if overdue_days == 14 and is_11_msk and (not user.admin_warn_14_at or user.admin_warn_14_at.date() != today_msk):
                    send_admins(
                        f"Пользователь {user.first_name or ''} @{user.username or ''} не оплатил тариф 14 дней. "
                        "Нужно заблокировать вручную."
                    )
                    user.admin_warn_14_at = now

    db.session.commit()

    # Pending ticket reminders and auto-reject
    now = datetime.utcnow()
    for t in TopUpTicket.query.filter_by(status='pending').all():
        user = User.query.get(t.user_id)
        if not user:
            continue
        age_hours = (now - (t.created_at or now)).total_seconds() / 3600

        if age_hours >= 48:
            t.status = 'rejected'
            t.updated_at = now
            t.rejected_at = now
            t.rejected_by = None
            send_bot_message(user.telegram_id, "Платёж отклонён (нет подтверждения более 48 часов).")
            for admin in User.query.filter_by(is_admin=True).all():
                send_bot_message(admin.telegram_id, (
                    f"Платёж пользователя {user.first_name or ''} @{user.username or ''} "
                    f"на сумму {t.amount:.2f} ₽ отклонён автоматически (48ч)."
                ))
            continue

        if age_hours >= 24:
            if not t.last_admin_notify_at or (now - t.last_admin_notify_at).total_seconds() >= 86400:
                notify_admins_topup(t, user)

    db.session.commit()


_billing_thread = None


def start_billing_thread(app):
    global _billing_thread
    if _billing_thread:
        return

    def billing_loop():
        while True:
            try:
                with app.app_context():
                    run_billing_cycle()
            except Exception as e:
                log_auth('billing_loop_error', error=str(e))
            time.sleep(3600)

    _billing_thread = threading.Thread(target=billing_loop, daemon=True)
    _billing_thread.start()
