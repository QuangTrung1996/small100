"""
WebSocket Handler for Chat Server
"""

import json
import logging
from typing import Dict, Optional
from fastapi import WebSocket
from models import (
    User, Room, Message, Member,
    MessageType, ErrorResponse,
    CreateRoomPayload, JoinRoomPayload,
    SendMessagePayload, UpdateProfilePayload,
    generate_id
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # user_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # user_id -> User
        self.users: Dict[str, User] = {}
        # room_id -> Room
        self.rooms: Dict[str, Room] = {}
        # room_code -> room_id
        self.room_codes: Dict[str, str] = {}
        # room_id -> List[user_id]
        self.room_members: Dict[str, list] = {}
        # room_id -> List[Message]
        self.room_messages: Dict[str, list] = {}
    
    async def connect(self, websocket: WebSocket) -> str:
        """Accept new WebSocket connection and return user_id"""
        await websocket.accept()
        user_id = generate_id()
        user = User(id=user_id)
        
        self.active_connections[user_id] = websocket
        self.users[user_id] = user
        
        logger.info(f"User connected: {user_id}")
        
        # Send connected message
        await self.send_personal_message({
            "type": MessageType.CONNECTED,
            "userId": user_id
        }, user_id)
        
        return user_id
    
    async def disconnect(self, user_id: str):
        """Handle user disconnect"""
        if user_id not in self.users:
            return
            
        user = self.users[user_id]
        
        # Leave room if in one
        if user.room_id:
            await self._leave_room(user_id)
        
        # Clean up
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.users:
            del self.users[user_id]
            
        logger.info(f"User disconnected: {user_id}")
    
    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to a specific user"""
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
    
    async def broadcast_to_room(self, message: dict, room_id: str, exclude_user: Optional[str] = None):
        """Broadcast message to all users in a room"""
        if room_id not in self.room_members:
            return
            
        for member_id in self.room_members[room_id]:
            if exclude_user and member_id == exclude_user:
                continue
            await self.send_personal_message(message, member_id)
    
    async def handle_message(self, user_id: str, data: dict):
        """Handle incoming WebSocket message"""
        msg_type = data.get("type")
        
        try:
            if msg_type == MessageType.CREATE_ROOM:
                await self._handle_create_room(user_id, data)
            elif msg_type == MessageType.JOIN_ROOM:
                await self._handle_join_room(user_id, data)
            elif msg_type == MessageType.LEAVE_ROOM:
                await self._handle_leave_room(user_id)
            elif msg_type == MessageType.SEND_MESSAGE:
                await self._handle_send_message(user_id, data)
            elif msg_type == MessageType.UPDATE_PROFILE:
                await self._handle_update_profile(user_id, data)
            elif msg_type == MessageType.GET_ROOM_INFO:
                await self._handle_get_room_info(user_id)
            elif msg_type == MessageType.PING:
                await self.send_personal_message({"type": MessageType.PONG}, user_id)
            else:
                await self._send_error(user_id, "INVALID_MESSAGE_TYPE", f"Unknown message type: {msg_type}")
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            await self._send_error(user_id, "INTERNAL_ERROR", str(e))
    
    async def _handle_create_room(self, user_id: str, data: dict):
        """Handle CREATE_ROOM message"""
        user = self.users.get(user_id)
        if not user:
            return
        
        # Leave current room if any
        if user.room_id:
            await self._leave_room(user_id)
        
        # Parse payload
        room_name = data.get("roomName", "New Room")
        host_name = data.get("hostName", "Host")
        language = data.get("language", "en")
        
        # Update user
        user.name = host_name
        user.language = language
        
        # Create room
        room = Room(name=room_name, host_id=user_id)
        self.rooms[room.id] = room
        self.room_codes[room.code] = room.id
        self.room_members[room.id] = [user_id]
        self.room_messages[room.id] = []
        
        # Update user's room
        user.room_id = room.id
        
        logger.info(f"Room created: {room.code} by {user.name}")
        
        # Send response
        await self.send_personal_message({
            "type": MessageType.ROOM_CREATED,
            "roomId": room.id,
            "roomCode": room.code,
            "room": room.to_dict(),
            "members": [user.to_member(is_host=True).to_dict()]
        }, user_id)
    
    async def _handle_join_room(self, user_id: str, data: dict):
        """Handle JOIN_ROOM message"""
        user = self.users.get(user_id)
        if not user:
            return
        
        room_code = data.get("roomCode", "").upper()
        user_name = data.get("userName", "Guest")
        language = data.get("language", "en")
        
        # Find room
        room_id = self.room_codes.get(room_code)
        if not room_id or room_id not in self.rooms:
            await self._send_error(user_id, "INVALID_ROOM_CODE", "Room not found")
            return
        
        room = self.rooms[room_id]
        
        # Leave current room if any
        if user.room_id:
            await self._leave_room(user_id)
        
        # Update user
        user.name = user_name
        user.language = language
        user.room_id = room_id
        
        # Add to room
        if user_id not in self.room_members[room_id]:
            self.room_members[room_id].append(user_id)
        
        logger.info(f"User {user.name} joined room {room.code}")
        
        # Get member list
        members = []
        for member_id in self.room_members[room_id]:
            member_user = self.users.get(member_id)
            if member_user:
                is_host = member_id == room.host_id
                members.append(member_user.to_member(is_host=is_host).to_dict())
        
        # Get recent messages
        recent_messages = self.room_messages.get(room_id, [])[-50:]
        
        # Send response to joining user
        await self.send_personal_message({
            "type": MessageType.ROOM_JOINED,
            "room": room.to_dict(),
            "members": members,
            "messages": [msg.to_dict() for msg in recent_messages]
        }, user_id)
        
        # Broadcast to other members
        await self.broadcast_to_room({
            "type": MessageType.USER_JOINED,
            "user": user.to_member().to_dict()
        }, room_id, exclude_user=user_id)
    
    async def _handle_leave_room(self, user_id: str):
        """Handle LEAVE_ROOM message"""
        await self._leave_room(user_id)
    
    async def _leave_room(self, user_id: str):
        """Remove user from their current room"""
        user = self.users.get(user_id)
        if not user or not user.room_id:
            return
        
        room_id = user.room_id
        room = self.rooms.get(room_id)
        
        # Remove from room members
        if room_id in self.room_members and user_id in self.room_members[room_id]:
            self.room_members[room_id].remove(user_id)
        
        # Broadcast to remaining members
        if room:
            await self.broadcast_to_room({
                "type": MessageType.USER_LEFT,
                "userId": user_id,
                "userName": user.name
            }, room_id)
        
        logger.info(f"User {user.name} left room {room.code if room else room_id}")
        
        # Clear user's room
        user.room_id = None
        
        # Clean up empty room
        if room_id in self.room_members and len(self.room_members[room_id]) == 0:
            self._cleanup_room(room_id)
    
    def _cleanup_room(self, room_id: str):
        """Clean up empty room"""
        room = self.rooms.get(room_id)
        if room:
            logger.info(f"Cleaning up empty room: {room.code}")
            if room.code in self.room_codes:
                del self.room_codes[room.code]
        
        if room_id in self.rooms:
            del self.rooms[room_id]
        if room_id in self.room_members:
            del self.room_members[room_id]
        if room_id in self.room_messages:
            del self.room_messages[room_id]
    
    async def _handle_send_message(self, user_id: str, data: dict):
        """Handle SEND_MESSAGE message"""
        user = self.users.get(user_id)
        if not user:
            return
        
        if not user.room_id:
            await self._send_error(user_id, "NOT_IN_ROOM", "You must join a room first")
            return
        
        text = data.get("text", "").strip()
        if not text:
            return
        
        # Create message
        message = Message(
            room_id=user.room_id,
            sender_id=user_id,
            sender_name=user.name,
            text=text,
            source_lang=user.language
        )
        
        # Store message
        if user.room_id in self.room_messages:
            self.room_messages[user.room_id].append(message)
            # Keep only last 100 messages
            if len(self.room_messages[user.room_id]) > 100:
                self.room_messages[user.room_id] = self.room_messages[user.room_id][-100:]
        
        logger.info(f"Message from {user.name} in room {user.room_id}: {text[:50]}...")
        
        # Broadcast to all members (including sender)
        await self.broadcast_to_room({
            "type": MessageType.NEW_MESSAGE,
            "message": message.to_dict()
        }, user.room_id)
    
    async def _handle_update_profile(self, user_id: str, data: dict):
        """Handle UPDATE_PROFILE message"""
        user = self.users.get(user_id)
        if not user:
            return
        
        name = data.get("name")
        language = data.get("language")
        
        old_name = user.name
        
        if name:
            user.name = name
        if language:
            user.language = language
        
        # Notify user
        await self.send_personal_message({
            "type": MessageType.PROFILE_UPDATED,
            "user": user.to_member().to_dict()
        }, user_id)
        
        # If in room, notify others about name change
        if user.room_id and name and name != old_name:
            await self.broadcast_to_room({
                "type": MessageType.USER_JOINED,  # Reuse to update member info
                "user": user.to_member().to_dict(),
                "isUpdate": True
            }, user.room_id, exclude_user=user_id)
    
    async def _handle_get_room_info(self, user_id: str):
        """Handle GET_ROOM_INFO message"""
        user = self.users.get(user_id)
        if not user or not user.room_id:
            await self._send_error(user_id, "NOT_IN_ROOM", "You are not in a room")
            return
        
        room = self.rooms.get(user.room_id)
        if not room:
            await self._send_error(user_id, "ROOM_NOT_FOUND", "Room not found")
            return
        
        # Get member list
        members = []
        for member_id in self.room_members.get(user.room_id, []):
            member_user = self.users.get(member_id)
            if member_user:
                is_host = member_id == room.host_id
                members.append(member_user.to_member(is_host=is_host).to_dict())
        
        await self.send_personal_message({
            "type": MessageType.ROOM_INFO,
            "room": room.to_dict(),
            "members": members
        }, user_id)
    
    async def _send_error(self, user_id: str, code: str, message: str):
        """Send error message to user"""
        error = ErrorResponse(code=code, message=message)
        await self.send_personal_message(error.to_dict(), user_id)


# Global connection manager
manager = ConnectionManager()
