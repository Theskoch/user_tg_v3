import os
import json
import time
import psutil
from datetime import datetime

from flask import Blueprint, request, jsonify

from db import db, User, ConfigItem, TopUpTicket
from utils import admin_required, apply_topup_action, add_months, LOG_PATH

admin_bp = Blueprint('admin', __name__)

TARIFFS_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'tariffs.json')


def load_tariffs():
    try:
        with open(TARIFFS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f).get('tariffs', [])
    except Exception:
        return []


@admin_bp.route('/api/admin/users', methods=['GET'])
def admin_users():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    tariffs = {t['id']: t for t in load_tariffs()}
    users = []
    for u in User.query.all():
        t = tariffs.get(u.tariff_id)
        users.append({
            **u.to_dict(),
            'role': 'admin' if u.is_admin else 'user',
            'tariff_name': t['name'] if t else None
        })
    return jsonify(users)


@admin_bp.route('/api/admin/user/set_tariff', methods=['POST'])
def admin_set_tariff():
    admin = admin_required()
    if not admin:
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    try:
        target_id = int(data.get('target_user_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad user id'}), 400
    user = User.query.get(target_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    tariff_id = data.get('tariff_id')
    user.tariff_id = tariff_id
    tariffs = {t['id']: t for t in load_tariffs()}
    t = tariffs.get(tariff_id)
    now = datetime.utcnow()
    user.tariff_next_charge_at = now
    user.tariff_paid_until = None
    if t:
        price = float(t.get('price_rub') or 0)
        months = int(t.get('period_months') or 1)
        if user.balance >= price:
            user.balance -= price
            user.tariff_paid_until = add_months(now, months)
            user.tariff_next_charge_at = user.tariff_paid_until
    db.session.commit()
    return jsonify({'ok': True})


@admin_bp.route('/api/admin/user/set_balance', methods=['POST'])
def admin_set_balance():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    try:
        target_id = int(data.get('target_user_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad user id'}), 400
    user = User.query.get(target_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    try:
        user.balance = float(data.get('balance'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad balance'}), 400
    db.session.commit()
    return jsonify({'ok': True})


@admin_bp.route('/api/admin/user/set_tariff_until', methods=['POST'])
def admin_set_tariff_until():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    try:
        target_id = int(data.get('target_user_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad user id'}), 400
    user = User.query.get(target_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    tariff_paid_until = data.get('tariff_paid_until')
    if tariff_paid_until:
        try:
            user.tariff_paid_until = datetime.fromisoformat(tariff_paid_until)
        except (TypeError, ValueError):
            return jsonify({'error': 'Bad date'}), 400
    else:
        user.tariff_paid_until = None
    user.tariff_next_charge_at = user.tariff_paid_until
    db.session.commit()
    return jsonify({'ok': True})


@admin_bp.route('/api/admin/user/delete', methods=['POST'])
def admin_delete_user():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    try:
        target_id = int(data.get('target_user_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad user id'}), 400
    user = User.query.get(target_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    ConfigItem.query.filter_by(user_id=user.id).delete()
    db.session.delete(user)
    db.session.commit()
    return jsonify({'ok': True})


@admin_bp.route('/api/admin/configs/list', methods=['POST'])
def admin_configs_list():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    try:
        target_id = int(data.get('target_user_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad user id'}), 400
    return jsonify([c.to_dict() for c in ConfigItem.query.filter_by(user_id=target_id).all()])


@admin_bp.route('/api/admin/configs/add', methods=['POST'])
def admin_configs_add():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    try:
        target_id = int(data.get('target_user_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad user id'}), 400
    item = ConfigItem(
        user_id=target_id,
        title=data.get('title') or 'Config',
        protocol=data.get('protocol'),
        name=data.get('name'),
        config_text=data.get('config_text') or ''
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict())


@admin_bp.route('/api/admin/configs/delete', methods=['POST'])
def admin_configs_delete():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    try:
        config_id = int(data.get('config_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad config id'}), 400
    item = ConfigItem.query.get(config_id)
    if not item:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({'ok': True})


@admin_bp.route('/api/admin/configs/update_name', methods=['POST'])
def admin_configs_update_name():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    name = (data.get('name') or '').strip() or 'Config'
    try:
        config_id = int(data.get('config_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad config id'}), 400
    item = ConfigItem.query.get(config_id)
    if not item:
        return jsonify({'error': 'Not found'}), 404
    item.name = name
    db.session.commit()
    return jsonify({'ok': True, 'name': name})


@admin_bp.route('/api/admin/topup/pending', methods=['GET'])
def admin_topup_pending():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    items = TopUpTicket.query.filter_by(status='pending').order_by(TopUpTicket.created_at.desc()).all()
    return jsonify([t.to_dict() for t in items])


@admin_bp.route('/api/admin/topup/history', methods=['POST'])
def admin_topup_history():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    try:
        target_id = int(data.get('target_user_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad user id'}), 400
    items = TopUpTicket.query.filter_by(user_id=target_id).order_by(TopUpTicket.created_at.desc()).all()
    result = []
    for t in items:
        payload = t.to_dict()
        if t.approved_by:
            a = User.query.get(t.approved_by)
            if a:
                payload['approved_by_name'] = f"{a.first_name or ''} @{a.username or ''}".strip()
        if t.rejected_by:
            a = User.query.get(t.rejected_by)
            if a:
                payload['rejected_by_name'] = f"{a.first_name or ''} @{a.username or ''}".strip()
        result.append(payload)
    return jsonify(result)


@admin_bp.route('/api/admin/console/stats', methods=['GET'])
def console_stats():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403

    cpu = psutil.cpu_percent(interval=0.3)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    uptime_sec = int(time.time() - psutil.boot_time())

    users_total   = User.query.count()
    configs_total = ConfigItem.query.count()
    pending_count = TopUpTicket.query.filter_by(status='pending').count()
    recent_topups = (
        TopUpTicket.query
        .order_by(TopUpTicket.created_at.desc())
        .limit(10).all()
    )
    topup_list = []
    for t in recent_topups:
        u = User.query.get(t.user_id)
        topup_list.append({
            **t.to_dict(),
            'user_name': f"{u.first_name or ''} @{u.username or ''}".strip() if u else '—',
        })

    return jsonify({
        'server': {
            'cpu_percent':   round(cpu, 1),
            'ram_percent':   round(ram.percent, 1),
            'ram_used_mb':   round(ram.used / 1024 / 1024),
            'ram_total_mb':  round(ram.total / 1024 / 1024),
            'disk_percent':  round(disk.percent, 1),
            'disk_used_gb':  round(disk.used / 1024 / 1024 / 1024, 1),
            'disk_total_gb': round(disk.total / 1024 / 1024 / 1024, 1),
            'uptime_sec':    uptime_sec,
        },
        'app': {
            'users_total':   users_total,
            'configs_total': configs_total,
            'pending_count': pending_count,
        },
        'recent_topups': topup_list,
    })


@admin_bp.route('/api/admin/console/logs', methods=['GET'])
def console_logs():
    if not admin_required():
        return jsonify({'error': 'Unauthorized'}), 403
    lines = []
    try:
        with open(LOG_PATH, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()[-80:]
    except FileNotFoundError:
        pass
    return jsonify({'lines': [l.rstrip('\n') for l in lines]})


@admin_bp.route('/api/admin/topup/act', methods=['POST'])
def admin_topup_act():
    admin = admin_required()
    if not admin:
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json or {}
    try:
        ticket_id = int(data.get('ticket_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad ticket id'}), 400
    action = data.get('action')
    ticket = TopUpTicket.query.get(ticket_id)
    if not ticket or ticket.status != 'pending':
        return jsonify({'error': 'Not found'}), 404
    if action == 'approve':
        apply_topup_action(ticket, admin, approve=True)
    elif action == 'reject':
        apply_topup_action(ticket, admin, approve=False)
    else:
        return jsonify({'error': 'Bad action'}), 400
    return jsonify({'ok': True})
