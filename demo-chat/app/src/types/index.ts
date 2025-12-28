export interface UserSettings {
  userName: string;
  language: string;
  serverUrl: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  language: string;
  isHost: boolean;
  joinedAt?: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  sourceLang: string;
  timestamp: string;
  translatedText?: string;
  isTranslating?: boolean;
}

export interface Language {
  code: string;
  name: string;
}

// WebSocket message types
export type ClientMessageType =
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'LEAVE_ROOM'
  | 'SEND_MESSAGE'
  | 'UPDATE_PROFILE'
  | 'GET_ROOM_INFO'
  | 'PING';

export type ServerMessageType =
  | 'CONNECTED'
  | 'ROOM_CREATED'
  | 'ROOM_JOINED'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'NEW_MESSAGE'
  | 'ROOM_INFO'
  | 'PROFILE_UPDATED'
  | 'ERROR'
  | 'PONG';

export interface ServerMessage {
  type: ServerMessageType;
  [key: string]: unknown;
}

export interface ConnectedMessage extends ServerMessage {
  type: 'CONNECTED';
  userId: string;
}

export interface RoomCreatedMessage extends ServerMessage {
  type: 'ROOM_CREATED';
  roomId: string;
  roomCode: string;
  room: Room;
  members: Member[];
}

export interface RoomJoinedMessage extends ServerMessage {
  type: 'ROOM_JOINED';
  room: Room;
  members: Member[];
  messages: Message[];
}

export interface UserJoinedMessage extends ServerMessage {
  type: 'USER_JOINED';
  user: Member;
  isUpdate?: boolean;
}

export interface UserLeftMessage extends ServerMessage {
  type: 'USER_LEFT';
  userId: string;
  userName: string;
}

export interface NewMessageMessage extends ServerMessage {
  type: 'NEW_MESSAGE';
  message: Message;
}

export interface ErrorMessage extends ServerMessage {
  type: 'ERROR';
  code: string;
  message: string;
}
