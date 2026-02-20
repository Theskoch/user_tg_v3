from app import app, db
import os

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    
    # Get local IP address
    import socket
    local_ip = socket.gethostbyname(socket.gethostname())
    
    print(f"Server accessible at:")
    print(f"http://localhost:5000")
    print(f"http://{local_ip}:5000")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
