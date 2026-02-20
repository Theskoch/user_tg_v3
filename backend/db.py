from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text
from datetime import datetime

db = SQLAlchemy()

class OneTimeCode(db.Model):
    __tablename__ = 'one_time_codes'
    
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime, nullable=True)

class User(db.Model):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    telegram_id = Column(String, unique=True, nullable=False)
    username = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    is_admin = Column(Boolean, default=False)
    balance = Column(Float, default=0.0)
    tariff_id = Column(Integer, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'telegram_id': self.telegram_id,
            'username': self.username,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'is_admin': self.is_admin,
            'balance': self.balance,
            'tariff_id': self.tariff_id
        }

class ConfigItem(db.Model):
    __tablename__ = 'configs'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    protocol = Column(String, nullable=True)
    name = Column(String, nullable=True)
    config_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'protocol': self.protocol,
            'name': self.name,
            'config_text': self.config_text,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
