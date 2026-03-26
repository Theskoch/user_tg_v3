import io
import os
import json
import base64

from flask import Blueprint, request, jsonify

from db import db, ConfigItem, TopUpTicket
from utils import get_auth_user, notify_admins_topup

user_bp = Blueprint('user', __name__)

TARIFFS_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'tariffs.json')


def load_tariffs():
    try:
        with open(TARIFFS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f).get('tariffs', [])
    except Exception:
        return []


@user_bp.route('/user', methods=['GET'])
def get_user():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    data = user.to_dict()
    tariffs = {t['id']: t for t in load_tariffs()}
    t = tariffs.get(user.tariff_id)
    if t:
        data['tariff_name'] = t.get('name')
        data['tariff_price_rub'] = t.get('price_rub')
        data['tariff_period_months'] = t.get('period_months')
    return jsonify(data)


@user_bp.route('/api/tariffs', methods=['GET'])
def api_tariffs():
    return jsonify({'tariffs': load_tariffs()})


@user_bp.route('/api/configs', methods=['GET'])
def user_configs():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    configs = ConfigItem.query.filter_by(user_id=user.id).all()
    return jsonify([c.to_dict() for c in configs])


@user_bp.route('/api/configs/mark_used', methods=['POST'])
def user_config_mark_used():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.json or {}
    try:
        config_id = int(data.get('config_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad config id'}), 400
    item = ConfigItem.query.get(config_id)
    if not item or item.user_id != user.id:
        return jsonify({'error': 'Not found'}), 404
    item.is_used = True
    db.session.commit()
    return jsonify({'ok': True})


@user_bp.route('/api/configs/update_name', methods=['POST'])
def user_config_update_name():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.json or {}
    name = (data.get('name') or '').strip() or 'Config'
    try:
        config_id = int(data.get('config_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad config id'}), 400
    item = ConfigItem.query.get(config_id)
    if not item or item.user_id != user.id:
        return jsonify({'error': 'Not found'}), 404
    item.name = name
    db.session.commit()
    return jsonify({'ok': True, 'name': name})


@user_bp.route('/api/topup/create', methods=['POST'])
def topup_create():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.json or {}
    try:
        amount = float(data.get('amount'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Bad amount'}), 400
    if amount <= 0:
        return jsonify({'error': 'Bad amount'}), 400
    method = (data.get('method') or 'transfer').strip() or 'transfer'
    ticket = TopUpTicket(user_id=user.id, amount=amount, status='pending', method=method)
    db.session.add(ticket)
    db.session.commit()
    try:
        notify_admins_topup(ticket, user)
        db.session.commit()
    except Exception:
        pass  # ticket is already saved; notifications are best-effort
    return jsonify({'ok': True, 'ticket': ticket.to_dict()})


@user_bp.route('/api/topup/history', methods=['GET'])
def topup_history():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    items = TopUpTicket.query.filter_by(user_id=user.id).order_by(TopUpTicket.created_at.desc()).all()
    return jsonify([t.to_dict() for t in items])


@user_bp.route('/api/qr', methods=['POST'])
def generate_qr():
    import qrcode
    from PIL import Image

    data = request.json or {}
    text = data.get('text') or ''
    if not text:
        return jsonify({'error': 'No text'}), 400
    size = max(120, min(int(data.get('size') or 320), 720))

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=0
    )
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white').convert('RGB')
    img = img.resize((size, size), Image.NEAREST)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    encoded = base64.b64encode(buf.getvalue()).decode('utf-8')
    return jsonify({'url': f'data:image/png;base64,{encoded}'})
