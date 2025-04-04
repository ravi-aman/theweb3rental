import asyncio
import socketio

# Server address (replace with actual ngrok or server URL)
SERVER_URL = "http://localhost:8765"

# Create a Socket.IO client
sio = socketio.AsyncClient()

@sio.event
async def connect():
    print("Connected to server.")
    await sio.emit("request_system_info")

@sio.event
async def system_info(data):
    print("Received system info:", data)

@sio.event
async def usage_stats(data):
    print("Received usage stats:", data)

@sio.event
async def container_result(data):
    print("Container result:", data)

@sio.event
async def container_list(data):
    print("Running containers:", data)

@sio.event
async def container_stop_result(data):
    print("Container stop result:", data)

@sio.event
async def disconnect():
    print("Disconnected from server.")

async def main():
    await sio.connect(SERVER_URL)
    await asyncio.sleep(2)  # Allow time to receive system info

    print("Starting a container...")
    await sio.emit("run_container", {
        "image": "nginx",  # Replace with desired image
        "resource_limits": {
            "cpu_count": 1,
            "memory": "512m",
            "gpu_count": 0
        },
        "container_name": "test_nginx"
    })
    
    await asyncio.sleep(3)  # Wait for container to start
    
    print("Listing running containers...")
    await sio.emit("list_containers")
    
    await asyncio.sleep(3)
    
    print("Stopping the container...")
    await sio.emit("stop_container_request", {"container_id": "test_nginx"})
    
    await asyncio.sleep(5)  # Allow time for response
    
    await sio.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
