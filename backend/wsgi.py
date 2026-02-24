from app import app, db, ensure_first_admin_code, ensure_schema, start_billing_thread

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        ensure_schema()
        ensure_first_admin_code()
        start_billing_thread()
    
    # Get local IP address
    import socket
    local_ip = socket.gethostbyname(socket.gethostname())
    
    # Avoid stdout prints in production environments
    try:
        from app import log_auth
        log_auth('server_start', host='0.0.0.0', port=5000, local_ip=local_ip)
    except Exception:
        pass
    
    app.run(host='0.0.0.0', port=5000, debug=False)
