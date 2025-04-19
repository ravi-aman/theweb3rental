import asyncio
import socketio
import json
import psutil
import platform
import GPUtil
import subprocess
import requests
import docker
from aiohttp import web
from pyngrok import ngrok
import datetime

# Create a Socket.IO server
sio = socketio.AsyncServer(cors_allowed_origins='*', async_mode='aiohttp')
app = web.Application()
sio.attach(app)

# Initialize Docker client
docker_client = docker.from_env()

# Connected clients tracking
connected_clients = set()

# Cache the system info to avoid recalculating it
system_info_cache = None

# Configuration
SERVER_NOTIFICATION_URL = "https://theweb3rental.vercel.app/api/ngrok"  # Replace with your server URL

# Start ngrok and expose server
def start_ngrok(port):
    public_url = ngrok.connect(port, "http").public_url
    print(f"Ngrok tunnel created: {public_url}")
    
    # Send the URL to your server
    send_url_to_server(public_url)
    
    return public_url

def send_url_to_server(url):
    """Send the ngrok URL to your server for tracking"""
    try:
        payload = {
            "ngrok_url": url,
            "timestamp": str(datetime.datetime.now()),
            "machine_id": platform.node()  # Use hostname as machine identifier
        }
        
        print(f"Sending payload to server: {payload}")
        
        headers = {"Content-Type": "application/json"}
        response = requests.post(SERVER_NOTIFICATION_URL, json=payload, headers=headers, timeout=10)
        
        print(f"Server response: Status={response.status_code}, Body={response.text}")
        
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

def run_docker_container(image, resource_limits, container_name=None):
    """
    Run a Docker container with specified resource limits
    
    Parameters:
    image (str): Docker image name
    resource_limits (dict): Resource limits including:
        - cpu_count: Number of CPUs
        - memory: Memory limit (e.g., '2g')
        - gpu_count: Number of GPUs to use
        - gpu_devices: List of specific GPU device IDs to use (optional)
    container_name (str): Optional name for the container
    
    Returns:
    dict: Container information
    """
    try:
        # Prepare device requests for GPUs
        device_requests = []
        if resource_limits.get('gpu_count', 0) > 0:
            # Specific GPU devices requested
            if 'gpu_devices' in resource_limits and resource_limits['gpu_devices']:
                device_ids = resource_limits['gpu_devices']
                device_requests.append(
                    docker.types.DeviceRequest(
                        count=-1,  # Use all specified devices
                        device_ids=device_ids,
                        capabilities=[['gpu']]
                    )
                )
            else:
                # Just request a number of GPUs
                device_requests.append(
                    docker.types.DeviceRequest(
                        count=resource_limits['gpu_count'],
                        capabilities=[['gpu']]
                    )
                )
        
        # Prepare CPU and memory limits
        cpu_count = resource_limits.get('cpu_count', 0)
        memory_limit = resource_limits.get('memory', '1g')
        
        # Convert CPU count to CPU period and quota
        cpu_period = 100000  # Default in Docker
        cpu_quota = int(cpu_period * cpu_count) if cpu_count > 0 else -1
        
        # Create and run the container
        container = docker_client.containers.run(
            image,
            name=container_name,
            detach=True,
            device_requests=device_requests,
            mem_limit=memory_limit,
            cpu_period=cpu_period,
            cpu_quota=cpu_quota,
            stdin_open=True,       # Keep STDIN open (important for interactive mode)
            tty=True,
        )
        
        # Get container info
        container_info = {
            'id': container.id,
            'name': container.name,
            'status': container.status,
            'image': image,
            'resource_limits': resource_limits
        }
        
        print(f"Container started: {container.name} (ID: {container.id})")
        return {'success': True, 'container': container_info}
        
    except docker.errors.ImageNotFound:
        error_msg = f"Docker image not found: {image}"
        print(error_msg)
        return {'success': False, 'error': error_msg}
    except docker.errors.APIError as e:
        error_msg = f"Docker API error: {str(e)}"
        print(error_msg)
        return {'success': False, 'error': error_msg}
    except Exception as e:
        error_msg = f"Error running container: {str(e)}"
        print(error_msg)
        return {'success': False, 'error': error_msg}

def get_container_list():
    """Get list of running Docker containers"""
    try:
        containers = docker_client.containers.list()
        container_list = []
        
        for container in containers:
            container_info = {
                'id': container.id,
                'name': container.name,
                'status': container.status,
                'image': container.image.tags[0] if container.image.tags else 'none'
            }
            container_list.append(container_info)
            
        return {'success': True, 'containers': container_list}
    except Exception as e:
        error_msg = f"Error listing containers: {str(e)}"
        print(error_msg)
        return {'success': False, 'error': error_msg}

def stop_container(container_id):
    """Stop a running Docker container"""
    try:
        container = docker_client.containers.get(container_id)
        container.stop()
        return {'success': True, 'message': f"Container {container_id} stopped"}
    except docker.errors.NotFound:
        return {'success': False, 'error': f"Container {container_id} not found"}
    except Exception as e:
        error_msg = f"Error stopping container: {str(e)}"
        print(error_msg)
        return {'success': False, 'error': error_msg}

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
async def run_container(sid, data):
    """Handle container run requests"""
    print(f"Received container run request: {data}")
    
    image = data.get('image')
    resource_limits = data.get('resource_limits', {})
    container_name = data.get('container_name')
    
    if not image:
        result = {'success': False, 'error': 'Image name is required'}
    else:
        result = run_docker_container(image, resource_limits, container_name)
    
    await sio.emit('container_result', result, room=sid)

@sio.event
async def list_containers(sid, *args):
    """Handle container list requests"""
    result = get_container_list()
    await sio.emit('container_list', result, room=sid)

@sio.event
async def stop_container_request(sid, data):
    """Handle container stop requests"""
    container_id = data.get('container_id')
    
    if not container_id:
        result = {'success': False, 'error': 'Container ID is required'}
    else:
        result = stop_container(container_id)
    
    await sio.emit('container_stop_result', result, room=sid)

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

# Function to set the server notification URL dynamically
def set_server_notification_url(url):
    global SERVER_NOTIFICATION_URL
    SERVER_NOTIFICATION_URL = url
    print(f"Server notification URL set to: {url}")

async def main():
    """Start Socket.IO server"""
    host = "0.0.0.0"  # Listen on all interfaces
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
        # Check if a server URL is provided as a command line argument
        import sys
        
        if len(sys.argv) > 1:
            set_server_notification_url(sys.argv[1])
        
        port = 8765
        ngrok_url = start_ngrok(port)
        print(f"Public URL: {ngrok_url}")
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer shutdown requested. Closing...")
    except Exception as e:
        print(f"Unexpected error: {e}")