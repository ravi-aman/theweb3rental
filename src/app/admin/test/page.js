
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
export {}; 
function App() {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [systemInfo, setSystemInfo] = useState(null);
    const [usageStats, setUsageStats] = useState([]);
    const [historyStats, setHistoryStats] = useState([]);
    const [containers, setContainers] = useState([]);
    const [newContainer, setNewContainer] = useState({
        image: '',
        container_name: '',
        resource_limits: {
            cpu_count: 1,
            memory: '1g',
            gpu_count: 0,
            gpu_devices: []
        }
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Connect to the Socket.IO server
    useEffect(() => {
        const socketUrl = 'https://da4d-125-16-66-215.ngrok-free.app';
        const socketInstance = io(socketUrl, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        // Socket event handlers
        socketInstance.on('connect', () => {
            console.log('Connected to server');
            setConnected(true);
            setError('');

            // Request system info immediately
            socketInstance.emit('request_system_info');

            // Request container list
            socketInstance.emit('list_containers');
        });

        socketInstance.on('disconnect', () => {
            console.log('Disconnected from server');
            setConnected(false);
        });

        socketInstance.on('connect_error', (err) => {
            console.error('Connection error:', err);
            setError(`Connection error: ${err.message}`);
            setConnected(false);
        });

        socketInstance.on('system_info', (data) => {
            console.log('Received system info:', data);
            setSystemInfo(data);
        });

        socketInstance.on('usage_stats', (data) => {
            console.log('Received usage stats:', data);
            setUsageStats(data);

            // Add timestamp and keep history for charts
            const timestamp = new Date().toLocaleTimeString();
            const newStat = { timestamp, ...data };

            setHistoryStats(prev => {
                const updated = [...prev, newStat];
                // Keep only last 30 data points
                return updated.length > 30 ? updated.slice(-30) : updated;
            });
        });

        socketInstance.on('container_list', (data) => {
            console.log('Received container list:', data);
            if (data.success) {
                setContainers(data.containers);
            } else {
                setError(`Failed to get containers: ${data.error}`);
            }
        });

        socketInstance.on('container_result', (data) => {
            console.log('Received container result:', data);
            if (data.success) {
                setSuccess(`Container ${data.container.name || data.container.id} started successfully`);
                // Refresh container list
                socketInstance.emit('list_containers');
            } else {
                setError(`Failed to start container: ${data.error}`);
            }
        });

        socketInstance.on('container_stop_result', (data) => {
            console.log('Received container stop result:', data);
            if (data.success) {
                setSuccess(data.message);
                // Refresh container list
                socketInstance.emit('list_containers');
            } else {
                setError(`Failed to stop container: ${data.error}`);
            }
        });

        setSocket(socketInstance);

        // Cleanup on unmount
        return () => {
            if (socketInstance) {
                socketInstance.disconnect();
            }
        };
    }, []);

    // Handle container form input changes
    const handleContainerInputChange = (e) => {
        const { name, value } = e.target;

        if (name.startsWith('resource_')) {
            const resourceName = name.replace('resource_', '');
            setNewContainer(prev => ({
                ...prev,
                resource_limits: {
                    ...prev.resource_limits,
                    [resourceName]: resourceName === 'gpu_devices'
                        ? value.split(',').map(v => v.trim()).filter(v => v)
                        : value
                }
            }));
        } else {
            setNewContainer(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    // Start a new container
    const handleStartContainer = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validate inputs
        if (!newContainer.image) {
            setError('Docker image name is required');
            return;
        }

        // Convert numeric values
        const formattedContainer = {
            ...newContainer,
            resource_limits: {
                ...newContainer.resource_limits,
                cpu_count: parseFloat(newContainer.resource_limits.cpu_count),
                gpu_count: parseInt(newContainer.resource_limits.gpu_count, 10)
            }
        };

        socket.emit('run_container', formattedContainer);
    };

    // Stop a container
    const handleStopContainer = (containerId) => {
        setError('');
        setSuccess('');
        socket.emit('stop_container_request', { container_id: containerId });
    };

    // Refresh container list
    const refreshContainers = () => {
        if (socket && connected) {
            socket.emit('list_containers');
        }
    };

    // Format GPU information for display
    const formatGpuInfo = (gpuInfo) => {
        if (!gpuInfo || gpuInfo.length === 0) {
            return 'None detected';
        }

        return gpuInfo.map((gpu, index) => (
            <div key={index} >
                {gpu.Name}({gpu.Memory} MB)
            </div>
        ));
    };

    return (
        <div className="container mx-auto p-4" >
            <h1 className="text-2xl font-bold mb-4" > System Monitoring & Docker Management </h1>

            {/* Connection status */}
            <div className="mb-4" >
                <div className={`inline-block px-2 py-1 rounded-full text-white ${connected ? 'bg-green-500' : 'bg-red-500'}`}>
                    {connected ? 'Connected' : 'Disconnected'}
                </div>
            </div>

            {
                error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" >
                        {error}
                    </div>
                )
            }

            {
                success && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4" >
                        {success}
                    </div>
                )
            }

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" >
                {/* System Information */}
                < div className="bg-white p-4 rounded shadow" >
                    <h2 className="text-xl font-semibold mb-3" > System Information </h2>

                    {
                        systemInfo ? (
                            <table className="w-full" >
                                <tbody>
                                    <tr>
                                        <td className="font-medium" > Operating System: </td>
                                        < td > {systemInfo.OS} </td>
                                    </tr>
                                    < tr >
                                        <td className="font-medium" > CPU: </td>
                                        < td > {systemInfo.CPU} </td>
                                    </tr>
                                    < tr >
                                        <td className="font-medium" > CPU Cores: </td>
                                        < td > {systemInfo.Cores}(Physical) / {systemInfo.Threads}(Logical) </td>
                                    </tr>
                                    < tr >
                                        <td className="font-medium" > RAM: </td>
                                        < td > {systemInfo.RAM} GB </td>
                                    </tr>
                                    < tr >
                                        <td className="font-medium" > GPU: </td>
                                        < td > {systemInfo.GPU ? formatGpuInfo(systemInfo.GPU) : 'None detected'} </td>
                                    </tr>
                                </tbody>
                            </table>
                        ) : (
                            <p>Loading system information...</p>
                        )
                    }
                </div>

                {/* Current Usage */}
                <div className="bg-white p-4 rounded shadow" >
                    <h2 className="text-xl font-semibold mb-3" > Current Resource Usage </h2>

                    {
                        usageStats.CPU_Usage !== undefined ? (
                            <div>
                                <div className="mb-2" >
                                    <div className="flex justify-between mb-1" >
                                        <span>CPU: {usageStats.CPU_Usage.toFixed(1)}% </span>
                                    </div>
                                    < div className="w-full bg-gray-200 rounded-full h-2.5" >
                                        <div
                                            className="bg-blue-600 h-2.5 rounded-full"
                                            style={{ width: `${Math.min(100, usageStats.CPU_Usage)}%` }
                                            }
                                        > </div>
                                    </div>
                                </div>

                                < div className="mb-2" >
                                    <div className="flex justify-between mb-1" >
                                        <span>Memory: {usageStats.Memory_Usage.toFixed(1)}% </span>
                                    </div>
                                    < div className="w-full bg-gray-200 rounded-full h-2.5" >
                                        <div
                                            className="bg-green-600 h-2.5 rounded-full"
                                            style={{ width: `${Math.min(100, usageStats.Memory_Usage)}%` }
                                            }
                                        > </div>
                                    </div>
                                </div>

                                < div className="mb-2" >
                                    <div className="flex justify-between mb-1" >
                                        <span>Disk: {usageStats.Disk_Usage.toFixed(1)}% </span>
                                    </div>
                                    < div className="w-full bg-gray-200 rounded-full h-2.5" >
                                        <div
                                            className="bg-yellow-600 h-2.5 rounded-full"
                                            style={{ width: `${Math.min(100, usageStats.Disk_Usage)}%` }}
                                        > </div>
                                    </div>
                                </div>

                                {
                                    usageStats.GPU_Usage > 0 && (
                                        <>
                                            <div className="mb-2" >
                                                <div className="flex justify-between mb-1" >
                                                    <span>GPU: {usageStats.GPU_Usage.toFixed(1)}% </span>
                                                </div>
                                                < div className="w-full bg-gray-200 rounded-full h-2.5" >
                                                    <div
                                                        className="bg-purple-600 h-2.5 rounded-full"
                                                        style={{ width: `${Math.min(100, usageStats.GPU_Usage)}%` }
                                                        }
                                                    > </div>
                                                </div>
                                            </div>

                                            < div className="mb-2" >
                                                <div className="flex justify-between mb-1" >
                                                    <span>GPU Memory: {usageStats.GPU_Memory_Usage.toFixed(1)}% </span>
                                                </div>
                                                < div className="w-full bg-gray-200 rounded-full h-2.5" >
                                                    <div
                                                        className="bg-red-600 h-2.5 rounded-full"
                                                        style={{ width: `${Math.min(100, usageStats.GPU_Memory_Usage)}%` }}
                                                    > </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                            </div>
                        ) : (
                            <p>Waiting for usage data...</p>
                        )}
                </div>
            </div>

            {/* Usage History Charts */}
            {
                historyStats.length > 0 && (
                    <div className="bg-white p-4 rounded shadow mt-6" >
                        <h2 className="text-xl font-semibold mb-3" > Resource Usage History </h2>

                        < div className="h-64" >
                            <ResponsiveContainer width="100%" height="100%" >
                                <LineChart
                                    data={historyStats}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }
                                    }
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="timestamp" />
                                    <YAxis domain={[0, 100]} />
                                    < Tooltip />
                                    <Legend />
                                    < Line type="monotone" dataKey="CPU_Usage" name="CPU %" stroke="#3b82f6" />
                                    <Line type="monotone" dataKey="Memory_Usage" name="Memory %" stroke="#10b981" />
                                    <Line type="monotone" dataKey="Disk_Usage" name="Disk %" stroke="#eab308" />
                                    {
                                        historyStats.some(stat => stat.GPU_Usage > 0) && (
                                            <>
                                                <Line type="monotone" dataKey="GPU_Usage" name="GPU %" stroke="#9333ea" />
                                                <Line type="monotone" dataKey="GPU_Memory_Usage" name="GPU Memory %" stroke="#ef4444" />
                                            </>
                                        )
                                    }
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

            {/* Docker Containers */}
            <div className="mt-6" >
                <div className="flex justify-between items-center mb-3" >
                    <h2 className="text-xl font-semibold" > Docker Containers </h2>
                    < button
                        onClick={refreshContainers}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                    >
                        Refresh
                    </button>
                </div>

                < div className="overflow-x-auto" >
                    <table className="min-w-full bg-white rounded shadow" >
                        <thead className="bg-gray-100" >
                            <tr>
                                <th className="px-4 py-2 text-left" > ID </th>
                                < th className="px-4 py-2 text-left" > Name </th>
                                < th className="px-4 py-2 text-left" > Image </th>
                                < th className="px-4 py-2 text-left" > Status </th>
                                < th className="px-4 py-2 text-left" > Actions </th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                containers.length > 0 ? (
                                    containers.map(container => (
                                        <tr key={container.id} className="border-t" >
                                            <td className="px-4 py-2" > {container.id.substring(0, 12)}...</td>
                                            < td className="px-4 py-2" > {container.name} </td>
                                            < td className="px-4 py-2" > {container.image} </td>
                                            < td className="px-4 py-2" >
                                                <span
                                                    className={`inline-block px-2 py-1 rounded-full text-white ${container.status === 'running' ? 'bg-green-500' : 'bg-yellow-500'
                                                        }`}
                                                >
                                                    {container.status}
                                                </span>
                                            </td>
                                            < td className="px-4 py-2" >
                                                {
                                                    container.status === 'running' && (
                                                        <button
                                                            onClick={() => handleStopContainer(container.id)}
                                                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                                                        >
                                                            Stop
                                                        </button>
                                                    )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-2 text-center" > No containers running </td>
                                    </tr>
                                )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Container Form */}
            <div className="bg-white p-4 rounded shadow mt-6" >
                <h2 className="text-xl font-semibold mb-3" > Start New Container </h2>

                < form onSubmit={handleStartContainer} >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" >
                        <div>
                            <label className="block mb-1" > Docker Image: </label>
                            < input
                                type="text"
                                name="image"
                                value={newContainer.image}
                                onChange={handleContainerInputChange}
                                placeholder="e.g., ubuntu:latest"
                                className="w-full px-3 py-2 border rounded"
                                required
                            />
                        </div>

                        < div >
                            <label className="block mb-1" > Container Name(optional): </label>
                            < input
                                type="text"
                                name="container_name"
                                value={newContainer.container_name}
                                onChange={handleContainerInputChange}
                                placeholder="e.g., my-ubuntu"
                                className="w-full px-3 py-2 border rounded"
                            />
                        </div>

                        < div >
                            <label className="block mb-1" > CPU Limit: </label>
                            < input
                                type="number"
                                name="resource_cpu_count"
                                value={newContainer.resource_limits.cpu_count}
                                onChange={handleContainerInputChange}
                                min="0.1"
                                step="0.1"
                                className="w-full px-3 py-2 border rounded"
                            />
                        </div>

                        < div >
                            <label className="block mb-1" > Memory Limit: </label>
                            < input
                                type="text"
                                name="resource_memory"
                                value={newContainer.resource_limits.memory}
                                onChange={handleContainerInputChange}
                                placeholder="e.g., 1g, 512m"
                                className="w-full px-3 py-2 border rounded"
                            />
                        </div>

                        < div >
                            <label className="block mb-1" > GPU Count: </label>
                            < input
                                type="number"
                                name="resource_gpu_count"
                                value={newContainer.resource_limits.gpu_count}
                                onChange={handleContainerInputChange}
                                min="0"
                                className="w-full px-3 py-2 border rounded"
                            />
                        </div>

                        < div >
                            <label className="block mb-1" > GPU Device IDs(comma - separated): </label>
                            < input
                                type="text"
                                name="resource_gpu_devices"
                                value={newContainer.resource_limits.gpu_devices.join(',')}
                                onChange={handleContainerInputChange}
                                placeholder="e.g., 0,1"
                                className="w-full px-3 py-2 border rounded"
                            />
                        </div>
                    </div>

                    < div className="mt-4" >
                        <button
                            type="submit"
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                            disabled={!connected}
                        >
                            Start Container
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default App;