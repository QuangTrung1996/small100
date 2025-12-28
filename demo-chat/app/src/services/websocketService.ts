/**
 * WebSocket Service
 * Handles real-time communication with the chat server
 */

import type {
  ServerMessage,
  ConnectedMessage,
  RoomCreatedMessage,
  RoomJoinedMessage,
  UserJoinedMessage,
  UserLeftMessage,
  NewMessageMessage,
  ErrorMessage,
} from '../types';

type MessageHandler = (message: ServerMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.url = url;
      
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.notifyConnectionHandlers(true);
          this.startPingInterval();
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.notifyConnectionHandlers(false);
          this.stopPingInterval();
          
          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
              this.connect(this.url).catch(console.error);
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as ServerMessage;
            this.notifyMessageHandlers(message);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  send(type: string, payload?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    const message = { type, ...payload };
    this.ws.send(JSON.stringify(message));
  }

  // Room operations
  createRoom(roomName: string, hostName: string, language: string): void {
    this.send('CREATE_ROOM', { roomName, hostName, language });
  }

  joinRoom(roomCode: string, userName: string, language: string): void {
    this.send('JOIN_ROOM', { roomCode, userName, language });
  }

  leaveRoom(): void {
    this.send('LEAVE_ROOM');
  }

  sendMessage(text: string): void {
    this.send('SEND_MESSAGE', { text });
  }

  updateProfile(name?: string, language?: string): void {
    this.send('UPDATE_PROFILE', { name, language });
  }

  getRoomInfo(): void {
    this.send('GET_ROOM_INFO');
  }

  // Event handling
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private notifyMessageHandlers(message: ServerMessage): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    });
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.send('PING');
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();

// Type guards for message types
export function isConnectedMessage(msg: ServerMessage): msg is ConnectedMessage {
  return msg.type === 'CONNECTED';
}

export function isRoomCreatedMessage(msg: ServerMessage): msg is RoomCreatedMessage {
  return msg.type === 'ROOM_CREATED';
}

export function isRoomJoinedMessage(msg: ServerMessage): msg is RoomJoinedMessage {
  return msg.type === 'ROOM_JOINED';
}

export function isUserJoinedMessage(msg: ServerMessage): msg is UserJoinedMessage {
  return msg.type === 'USER_JOINED';
}

export function isUserLeftMessage(msg: ServerMessage): msg is UserLeftMessage {
  return msg.type === 'USER_LEFT';
}

export function isNewMessageMessage(msg: ServerMessage): msg is NewMessageMessage {
  return msg.type === 'NEW_MESSAGE';
}

export function isErrorMessage(msg: ServerMessage): msg is ErrorMessage {
  return msg.type === 'ERROR';
}
