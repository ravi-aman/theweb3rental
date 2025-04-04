import asyncio
import socketio
import json
import psutil
import platform
import GPUtil
import subprocess
import datetime
from aiohttp import web
from pyngrok import ngrok
import requests

# Create a Socket.IO server
sio = socketio.AsyncServer(cors_allowed_origins='*', async_mode='aiohttp')
app = web.Application()
sio.attach(app)

# Connected clients tracking
connected_clients = set()

# Cache the system info to avoid recalculating it
system_info_cache = None

SERVER_NOTIFICATION_URL = "https://theweb3rental.vercel.app/api/ngrok"  # Replace with your server URL

# Start ngrok and expose server
def start_ngrok(port):
    public_url = ngrok.connect(port, "http").public_url
    print(f"Ngrok tunnel created: {public_url}")
    send_url_to_server(public_url)  # Send the URL to your server
    return public_url

def send_url_to_server(url):
    """Send the ngrok URL to your server for tracking"""
    try:
        payload = {
            "ngrok_url": url,
            "timestamp": str(datetime.datetime.now()),
            "machine_id": platform.node()  # Use hostname as machine identifier
        }
        
        response = requests.post(SERVER_NOTIFICATION_URL, json=payload, timeout=10)
        
        if response.status_code == 200:
            print(f"Successfully sent URL to server: {url}")
        else:
            print(f"Failed to send URL to server. Status code: {response.status_code}")
    except Exception as e:
        print(f"Error sending URL to server: {e}")

async def get_system_info():
    """Fetch system information (sent once)."""
    global system_info_cache
    
    # Return cached info if available
    if system_info_cache:
        return system_info_cache
        
    info = {
        "OS": platform.system() + " " + platform.release(),
        "CPU": platform.processor(),
        "Cores": psutil.cpu_count(logical=False),
        "Threads": psutil.cpu_count(logical=True),
        "RAM": round(psutil.virtual_memory().total / (1024 ** 3), 2),
    }
    gpus = GPUtil.getGPUs()
    if gpus:
        info["GPU"] = [{"Name": gpu.name, "Memory": gpu.memoryTotal} for gpu in gpus]
    
    # Cache the result
    system_info_cache = info
    return info

async def get_usage():
    """Fetch real-time usage statistics."""
    try:
        command = "nvidia-smi --query-gpu=utilization.gpu,utilization.memory --format=csv"
        result = subprocess.run(command, capture_output=True, text=True, shell=True)
        gpu_util, gpu_mem_util = 0, 0
        if result.stdout:
            lines = result.stdout.strip().split('\n')
            if len(lines) > 1:
                values = lines[1].split(',')
                if len(values) >= 2:
                    gpu_util = float(values[0].strip().replace('%', '')) if values[0].strip().replace('%', '').isdigit() else 0
                    gpu_mem_util = float(values[1].strip().replace('%', '')) if values[1].strip().replace('%', '').isdigit() else 0
    except:
        gpu_util, gpu_mem_util = 0, 0
    
    cpu_usage = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    usage = {
        "CPU_Usage": cpu_usage,
        "Memory_Usage": memory.percent,
        "Disk_Usage": disk.percent,
        "GPU_Usage": gpu_util,
        "GPU_Memory_Usage": gpu_mem_util,
    }
    return usage

@sio.event
async def connect(sid, environ):
    """Handle new client connections"""
    print(f"Client connected: {sid}")
    connected_clients.add(sid)
    
    # Ensure system_info is ready
    system_info = await get_system_info()
    
    # Send system information immediately upon connection
    # Use a slight delay to ensure the client is ready to receive
    await asyncio.sleep(0.5)
    await sio.emit('system_info', system_info, room=sid)
    print(f"Sent system_info to {sid}")
    
    # Start sending regular usage updates
    sio.start_background_task(send_usage_updates, sid)

@sio.event
async def request_system_info(sid, *args):
    """Handle explicit requests for system info"""
    system_info = await get_system_info()
    await sio.emit('system_info', system_info, room=sid)
    print(f"Sent system_info to {sid} (by request)")

@sio.event
async def disconnect(sid):
    """Handle client disconnections"""
    print(f"Client disconnected: {sid}")
    if sid in connected_clients:
        connected_clients.remove(sid)

async def send_usage_updates(sid):
    """Send regular usage updates to the connected client"""
    try:
        # Send system info again with the first usage update to ensure it's received
        system_info = await get_system_info()
        if sid in connected_clients:
            await sio.emit('system_info', system_info, room=sid)
            print(f"Sent system_info again with first usage update to {sid}")
            
        while sid in connected_clients:
            usage_stats = await get_usage()
            if sid in connected_clients:  # Check again to avoid EmitError
                await sio.emit('usage_stats', usage_stats, room=sid)
            await asyncio.sleep(2)
    except Exception as e:
        print(f"Error sending updates to {sid}: {e}")

async def main():
    """Start Socket.IO server"""
    host = "localhost"  # Listen on all interfaces
    port = 8765
    
    # Pre-cache system info
    await get_system_info()
    
    # Start the server
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    
    print(f"Socket.IO server started on http://{host}:{port}")
    print("Waiting for connections...")
    
    # Keep the server running
    while True:
        await asyncio.sleep(3600)  # Just to keep the task alive

if __name__ == "__main__":
    try:
        port = 8765
        ngrok_url = start_ngrok(port)
        print(f"Public URL: {ngrok_url}")
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer shutdown requested. Closing...")
    except Exception as e:
        print(f"Unexpected error: {e}")