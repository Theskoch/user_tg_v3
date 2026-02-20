#!/bin/bash

# Deployment script for Telegram Mini App

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Generate secret key if not exists
if [ ! -f .env ]; then
    echo "Generating secret key..."
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(16))")
    echo "SECRET_KEY=$SECRET_KEY" > .env
fi

# Run database migrations
cd backend
python3 -c "from app import app, db; 
with app.app_context():
    db.create_all()
    print('Database initialized successfully')"

echo "Deployment complete. Use gunicorn to run the application:"
echo "gunicorn --workers 3 --bind 0.0.0.0:5000 wsgi:app"