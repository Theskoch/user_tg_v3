import secrets
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, session

from db import db, User, OneTimeCode
from extensions import limiter
from utils import verify_telegram_init_data, get_auth_user, log_auth
from bot_setup import BOT_TOKEN

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/auth', methods=['POST'])
@limiter.limit("15 per minute")
def authenticate():
    data = request.get_json(silent=True) or {}
    code = (data.get('code') or '').strip()
    init_data = (data.get('init_data') or '').strip()

    log_auth('auth_called', has_init_data=bool(init_data))

    telegram_user = verify_telegram_init_data(init_data, BOT_TOKEN)
    if not telegram_user or not telegram_user.get('id'):
        log_auth('auth_invalid_init_data')
        return jsonify({'success': False, 'message': 'Откройте приложение из Telegram'}), 400

    tg_id = str(telegram_user['id'])

    # Auto-login if user already registered
    existing_user = User.query.filter_by(telegram_id=tg_id).first()
    if existing_user:
        session['telegram_id'] = tg_id
        session.permanent = True
        log_auth('auth_auto_login', tg_id=tg_id)
        return jsonify({
            'success': True,
            'is_admin': existing_user.is_admin,
            'user': existing_user.to_dict(),
            'auto': True
        })

    # New user — validate one-time code
    if not code:
        return jsonify({'success': False, 'message': 'Введите код доступа'})

    one_time_code = OneTimeCode.query.filter_by(code=code).first()
    if not one_time_code or one_time_code.used_at:
        log_auth('auth_invalid_code', tg_id=tg_id, reason='not_found_or_used')
        return jsonify({'success': False, 'message': 'Код недействителен'})

    if one_time_code.created_at < datetime.utcnow() - timedelta(hours=1):
        log_auth('auth_invalid_code', tg_id=tg_id, reason='expired')
        return jsonify({'success': False, 'message': 'Код недействителен'})

    new_user = User(
        telegram_id=tg_id,
        username=telegram_user.get('username'),
        first_name=telegram_user.get('first_name'),
        last_name=telegram_user.get('last_name'),
        is_admin=one_time_code.is_admin
    )
    db.session.add(new_user)
    one_time_code.used_at = datetime.utcnow()
    db.session.commit()

    session['telegram_id'] = tg_id
    session.permanent = True
    log_auth('auth_created_user', tg_id=tg_id, is_admin=one_time_code.is_admin)

    return jsonify({
        'success': True,
        'is_admin': one_time_code.is_admin,
        'user': new_user.to_dict()
    })


@auth_bp.route('/generate_code', methods=['POST'])
def generate_code():
    user = get_auth_user()
    if not user or not user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.json or {}
    is_admin = data.get('role') == 'admin'

    while True:
        code = secrets.token_urlsafe(6)
        if not OneTimeCode.query.filter_by(code=code).first():
            break

    new_code = OneTimeCode(code=code, is_admin=is_admin)
    db.session.add(new_code)
    db.session.commit()

    return jsonify({'code': code, 'role': 'admin' if is_admin else 'user'})
