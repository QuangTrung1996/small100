"""
Chat Server - FastAPI + WebSocket
Demo server for Small100-ONNX Translation Chat App
"""

import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from websocket_handler import manager
from models import SUPPORTED_LANGUAGES

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("Chat server starting...")
    yield
    logger.info("Chat server shutting down...")


app = FastAPI(
    title="Small100 Translation Chat Server",
    description="WebSocket server for real-time multilingual chat",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Small100 Translation Chat Server",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "connections": len(manager.active_connections),
        "rooms": len(manager.rooms)
    }


@app.get("/api/languages")
async def get_languages():
    """Get supported languages"""
    return {
        "languages": [
            {"code": code, "name": name}
            for code, name in SUPPORTED_LANGUAGES.items()
        ]
    }


@app.get("/api/rooms/{room_code}")
async def get_room_info(room_code: str):
    """Get public room info by code"""
    room_code = room_code.upper()
    room_id = manager.room_codes.get(room_code)
    
    if not room_id:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = manager.rooms.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    member_count = len(manager.room_members.get(room_id, []))
    
    return {
        "name": room.name,
        "code": room.code,
        "memberCount": member_count,
        "createdAt": room.created_at.isoformat()
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for chat"""
    user_id = await manager.connect(websocket)
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                await manager.handle_message(user_id, message)
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "ERROR",
                    "code": "INVALID_JSON",
                    "message": "Invalid JSON format"
                }, user_id)
                
    except WebSocketDisconnect:
        await manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        await manager.disconnect(user_id)


@app.get("/api/stats")
async def get_stats():
    """Get server statistics"""
    return {
        "activeConnections": len(manager.active_connections),
        "activeRooms": len(manager.rooms),
        "totalMessages": sum(
            len(messages) for messages in manager.room_messages.values()
        )
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
