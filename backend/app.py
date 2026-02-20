import os
import secrets
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from config import Config
from db import db, User
import telebot
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.config.from_object(Config)

# Configure for Nginx proxy
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# More permissive CORS
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
db.init_app(app)

# Configure session 
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(16))
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Disable secure cookie for local development
app.config['SESSION_COOKIE_SECURE'] = False

# Telegram Bot Setup
BOT_TOKEN = os.environ.get('BOT_TOKEN')
bot = telebot.TeleBot(BOT_TOKEN)

# First-time admin code generation
FIRST_TIME_ADMIN_CODE = Config.FIRST_TIME_ADMIN_CODE
print(f"FIRST TIME ADMIN CODE: {FIRST_TIME_ADMIN_CODE}")

@app.route('/auth', methods=['POST'])
def authenticate():
    data = request.json
    code = data.get('code')
    telegram_data = data.get('telegram_user')
    
    # First-time admin authentication
    if code == FIRST_TIME_ADMIN_CODE:
        # Create first admin user
        existing_user = User.query.filter_by(telegram_id=telegram_data['id']).first()
        if not existing_user:
            new_user = User(
                telegram_id=telegram_data['id'],
                username=telegram_data.get('username'),
                first_name=telegram_data.get('first_name'),
                last_name=telegram_data.get('last_name'),
                is_admin=True
            )
            db.session.add(new_user)
            db.session.commit()
        
        session['user_id'] = existing_user.id if existing_user else new_user.id
        return jsonify({'success': True, 'is_admin': True})
    
    # Regular user authentication (to be implemented)
    return jsonify({'success': False, 'message': 'Invalid code'})

@app.route('/user', methods=['GET'])
def get_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify(user.to_dict())

@app.route('/admin', methods=['GET'])
def admin_panel():
    user_id = session.get('user_id')
    user = User.query.get(user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify({'message': 'Welcome to admin panel'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)