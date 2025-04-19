# socket_server.py
from flask import Flask
from flask_socketio import SocketIO

# Step 1: Flask app
app = Flask(__name__)

# Step 2: SocketIO layer added on top of Flask
socketio = SocketIO(app, cors_allowed_origins="*")

# Step 3: Event handlers
@socketio.on('connect')
def handle_connect():
    print('✅ Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('❌ Client disconnected')

# Step 4: Run the WebSocket server on port 8765
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8765)
