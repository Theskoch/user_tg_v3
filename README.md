# Telegram Mini App

## Local Development Setup

### Prerequisites
- Python 3.8+
- pip
- virtualenv

### Installation Steps
1. Clone the repository
2. Create virtual environment
```bash
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies
```bash
pip install -r backend/requirements.txt
```

4. Set environment variables (optional)
```bash
export BOT_TOKEN=your_telegram_bot_token
```

### Running the Application
```bash
# From project root
cd backend
python wsgi.py
```

### Access Methods
- Local Browser: `http://localhost:5000`
- Local Network: `http://<your_local_ip>:5000`
- Telegram Mini App: Via your configured domain/proxy

### First-Time Setup
- The first admin login code will be printed in the console
- Use this code with your Telegram user to create the first admin account

### Resetting the Database (dev only)
If you plan to start from scratch (project not in production yet):
1. Stop the server
2. Delete the sqlite database file (location depends on your config)
3. Start the server again — tables will be created automatically

## Deployment Notes
- For production, use gunicorn:
```bash
gunicorn --workers 3 --bind 0.0.0.0:5000 wsgi:app
```

## Troubleshooting
- Ensure all dependencies are installed
- Check that Telegram Bot Token is correctly set
- Verify network/firewall settings allow access