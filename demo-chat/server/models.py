"""
Data models for Chat Server
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum
import uuid


def generate_id() -> str:
    return str(uuid.uuid4())


def generate_room_code() -> str:
    """Generate a 6-character room code"""
    import random
    import string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


class MessageType(str, Enum):
    # Client -> Server
    CREATE_ROOM = "CREATE_ROOM"
    JOIN_ROOM = "JOIN_ROOM"
    LEAVE_ROOM = "LEAVE_ROOM"
    SEND_MESSAGE = "SEND_MESSAGE"
    UPDATE_PROFILE = "UPDATE_PROFILE"
    GET_ROOM_INFO = "GET_ROOM_INFO"
    PING = "PING"
    
    # Server -> Client
    CONNECTED = "CONNECTED"
    ROOM_CREATED = "ROOM_CREATED"
    ROOM_JOINED = "ROOM_JOINED"
    USER_JOINED = "USER_JOINED"
    USER_LEFT = "USER_LEFT"
    NEW_MESSAGE = "NEW_MESSAGE"
    ROOM_INFO = "ROOM_INFO"
    PROFILE_UPDATED = "PROFILE_UPDATED"
    ERROR = "ERROR"
    PONG = "PONG"


class Member(BaseModel):
    id: str
    name: str
    language: str
    is_host: bool = False
    joined_at: datetime = Field(default_factory=datetime.now)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "language": self.language,
            "isHost": self.is_host,
            "joinedAt": self.joined_at.isoformat()
        }


class Message(BaseModel):
    id: str = Field(default_factory=generate_id)
    room_id: str
    sender_id: str
    sender_name: str
    text: str
    source_lang: str
    timestamp: datetime = Field(default_factory=datetime.now)
    
    def to_dict(self):
        return {
            "id": self.id,
            "roomId": self.room_id,
            "senderId": self.sender_id,
            "senderName": self.sender_name,
            "text": self.text,
            "sourceLang": self.source_lang,
            "timestamp": self.timestamp.isoformat()
        }


class Room(BaseModel):
    id: str = Field(default_factory=generate_id)
    code: str = Field(default_factory=generate_room_code)
    name: str
    host_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    
    def to_dict(self, include_code: bool = True):
        result = {
            "id": self.id,
            "name": self.name,
            "hostId": self.host_id,
            "createdAt": self.created_at.isoformat()
        }
        if include_code:
            result["code"] = self.code
        return result


class User(BaseModel):
    id: str = Field(default_factory=generate_id)
    name: str = "Anonymous"
    language: str = "en"
    room_id: Optional[str] = None
    
    def to_member(self, is_host: bool = False) -> Member:
        return Member(
            id=self.id,
            name=self.name,
            language=self.language,
            is_host=is_host
        )


# WebSocket Message Schemas
class CreateRoomPayload(BaseModel):
    room_name: str = Field(alias="roomName")
    host_name: str = Field(alias="hostName")
    language: str


class JoinRoomPayload(BaseModel):
    room_code: str = Field(alias="roomCode")
    user_name: str = Field(alias="userName")
    language: str


class SendMessagePayload(BaseModel):
    text: str


class UpdateProfilePayload(BaseModel):
    name: Optional[str] = None
    language: Optional[str] = None


class ErrorResponse(BaseModel):
    type: str = "ERROR"
    code: str
    message: str
    
    def to_dict(self):
        return {
            "type": self.type,
            "code": self.code,
            "message": self.message
        }


# Supported Languages
SUPPORTED_LANGUAGES = {
    "vi": "Tiếng Việt",
    "en": "English",
    "ja": "日本語",
    "zh": "中文",
    "ko": "한국어",
    "fr": "Français",
    "de": "Deutsch",
    "es": "Español",
    "th": "ไทย",
    "id": "Bahasa Indonesia",
    "ru": "Русский",
    "pt": "Português",
    "it": "Italiano",
    "ar": "العربية",
    "hi": "हिन्दी",
    "bn": "বাংলা",
    "ms": "Bahasa Melayu",
    "nl": "Nederlands",
    "pl": "Polski",
    "tr": "Türkçe",
}
