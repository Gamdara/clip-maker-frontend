from fastapi import WebSocket
from typing import Dict, Set
import asyncio
import json


class ConnectionManager:
    """Manages WebSocket connections for real-time job status updates"""

    def __init__(self):
        # job_id -> Set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, job_id: str):
        """Accept WebSocket connection and subscribe to job updates"""
        await websocket.accept()

        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()

        self.active_connections[job_id].add(websocket)
        print(f"Client connected to job {job_id}. Total connections: {len(self.active_connections[job_id])}")

    def disconnect(self, websocket: WebSocket, job_id: str):
        """Remove WebSocket connection"""
        if job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)

            # Clean up empty job subscriptions
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]

        print(f"Client disconnected from job {job_id}")

    async def broadcast_status(self, job_id: str, status_data: dict):
        """Broadcast status update to all clients subscribed to this job"""
        if job_id not in self.active_connections:
            return

        # Remove disconnected clients while broadcasting
        dead_connections = set()

        for connection in self.active_connections[job_id]:
            try:
                await connection.send_json(status_data)
            except Exception as e:
                print(f"Error sending to client: {e}")
                dead_connections.add(connection)

        # Clean up dead connections
        for connection in dead_connections:
            self.disconnect(connection, job_id)


# Global connection manager instance
manager = ConnectionManager()
