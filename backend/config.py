import os
import secrets

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-change-me'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///users.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 24 * 365 * 10
    WEBAPP_URL = os.environ.get('WEBAPP_URL')
    BOT_USERNAME = os.environ.get('BOT_USERNAME')
    WEBAPP_SHORT_NAME = os.environ.get('WEBAPP_SHORT_NAME')