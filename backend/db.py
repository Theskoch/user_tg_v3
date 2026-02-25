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
    tariff_paid_until = Column(DateTime, nullable=True)
    tariff_next_charge_at = Column(DateTime, nullable=True)
    last_low_balance_warn_at = Column(DateTime, nullable=True)
    last_overdue_admin_at = Column(DateTime, nullable=True)
    user_warn_14_at = Column(DateTime, nullable=True)
    user_warn_7_at = Column(DateTime, nullable=True)
    user_warn_0_at = Column(DateTime, nullable=True)
    user_overdue_daily_at = Column(DateTime, nullable=True)
    admin_warn_0_at = Column(DateTime, nullable=True)
    admin_warn_7_at = Column(DateTime, nullable=True)
    admin_warn_14_at = Column(DateTime, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'telegram_id': self.telegram_id,
            'username': self.username,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'is_admin': self.is_admin,
            'balance': self.balance,
            'tariff_id': self.tariff_id,
            'tariff_paid_until': self.tariff_paid_until.isoformat() if self.tariff_paid_until else None,
            'tariff_next_charge_at': self.tariff_next_charge_at.isoformat() if self.tariff_next_charge_at else None
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
    is_used = Column(Boolean, default=False)

    def to_dict(self):
        safe_text = (self.config_text or '').replace('\u0000', '')
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'protocol': self.protocol,
            'name': self.name,
            'config_text': safe_text,
            'created_at': self.created_at.isoformat() if self.created_at else None
            , 'is_used': self.is_used
        }

class TopUpTicket(db.Model):
    __tablename__ = 'topup_tickets'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, default='pending')  # pending | approved | rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    approved_by = Column(Integer, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_by = Column(Integer, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    last_admin_notify_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'amount': self.amount,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'rejected_by': self.rejected_by,
            'rejected_at': self.rejected_at.isoformat() if self.rejected_at else None
        }
