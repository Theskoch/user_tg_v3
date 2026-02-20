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
    
    print(f"Server accessible at:")
    print(f"http://localhost:5000")
    print(f"http://{local_ip}:5000")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
