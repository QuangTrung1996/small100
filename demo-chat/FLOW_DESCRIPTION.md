# Mô Tả Luồng Xử Lý - Demo Chat App

## Tổng Quan Kiến Trúc

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DEMO CHAT APP                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     WebSocket      ┌─────────────────────────────┐    │
│  │   React App     │◄──────────────────►│     Python Server           │    │
│  │  (Web/Android/  │                    │   (FastAPI + WebSocket)     │    │
│  │      iOS)       │                    │                             │    │
│  └────────┬────────┘                    └─────────────────────────────┘    │
│           │                                                                 │
│           │ Translation                                                     │
│           ▼                                                                 │
│  ┌─────────────────┐                                                       │
│  │ Small100 ONNX   │                                                       │
│  │ Translator      │                                                       │
│  │ Plugin          │                                                       │
│  └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Luồng Xử Lý Chi Tiết

### 1. Khởi Động Ứng Dụng

```
┌──────────┐     ┌───────────────┐     ┌────────────────┐
│   User   │────►│   App Start   │────►│ Load Settings  │
└──────────┘     └───────────────┘     └───────┬────────┘
                                               │
                      ┌────────────────────────┼────────────────────────┐
                      │                        │                        │
                      ▼                        ▼                        ▼
              ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
              │ Check Model  │        │ Load User    │        │ Connect to   │
              │ Downloaded?  │        │ Preferences  │        │ Server       │
              └──────┬───────┘        └──────────────┘        └──────────────┘
                     │
          ┌─────────┴─────────┐
          │ No                │ Yes
          ▼                   ▼
   ┌──────────────┐   ┌──────────────┐
   │ Download     │   │ Initialize   │
   │ Model Files  │   │ Translator   │
   └──────────────┘   └──────────────┘
```

### 2. Luồng Tạo Phòng Chat

```
┌──────────┐                    ┌────────────┐                    ┌────────────┐
│   User   │                    │  React App │                    │   Server   │
└────┬─────┘                    └─────┬──────┘                    └─────┬──────┘
     │                                │                                 │
     │ 1. Click "Create Room"         │                                 │
     │───────────────────────────────►│                                 │
     │                                │                                 │
     │                                │ 2. WebSocket: CREATE_ROOM       │
     │                                │ {roomName, hostName, language}  │
     │                                │────────────────────────────────►│
     │                                │                                 │
     │                                │                                 │ 3. Generate
     │                                │                                 │    Room ID
     │                                │                                 │    & Store
     │                                │                                 │
     │                                │ 4. ROOM_CREATED                 │
     │                                │ {roomId, roomCode}              │
     │                                │◄────────────────────────────────│
     │                                │                                 │
     │ 5. Show Room Code              │                                 │
     │◄───────────────────────────────│                                 │
     │                                │                                 │
```

### 3. Luồng Tham Gia Phòng

```
┌──────────┐                    ┌────────────┐                    ┌────────────┐
│   User   │                    │  React App │                    │   Server   │
└────┬─────┘                    └─────┬──────┘                    └─────┬──────┘
     │                                │                                 │
     │ 1. Enter Room Code             │                                 │
     │    & Click "Join"              │                                 │
     │───────────────────────────────►│                                 │
     │                                │                                 │
     │                                │ 2. WebSocket: JOIN_ROOM         │
     │                                │ {roomCode, userName, language}  │
     │                                │────────────────────────────────►│
     │                                │                                 │
     │                                │                                 │ 3. Validate
     │                                │                                 │    & Add User
     │                                │                                 │
     │                                │ 4. ROOM_JOINED                  │
     │                                │ {roomInfo, members}             │
     │                                │◄────────────────────────────────│
     │                                │                                 │
     │                                │ 5. Broadcast: USER_JOINED       │
     │                                │────────────────────────────────►│
     │                                │                                 │ (to all members)
     │ 6. Enter Chat Room             │                                 │
     │◄───────────────────────────────│                                 │
     │                                │                                 │
```

### 4. Luồng Gửi Tin Nhắn (Với Dịch Thuật)

```
┌──────────┐              ┌────────────┐              ┌────────────┐              ┌────────────┐
│  User A  │              │  App (A)   │              │   Server   │              │  App (B)   │
│ (Vietnamese)            │            │              │            │              │ (Japanese) │
└────┬─────┘              └─────┬──────┘              └─────┬──────┘              └─────┬──────┘
     │                          │                          │                          │
     │ 1. Type: "Xin chào"      │                          │                          │
     │─────────────────────────►│                          │                          │
     │                          │                          │                          │
     │                          │ 2. SEND_MESSAGE          │                          │
     │                          │ {text, sourceLang: "vi"} │                          │
     │                          │─────────────────────────►│                          │
     │                          │                          │                          │
     │                          │                          │ 3. Broadcast to          │
     │                          │                          │    all members           │
     │                          │                          │                          │
     │                          │                          │ 4. NEW_MESSAGE           │
     │                          │                          │ {text, sourceLang}       │
     │                          │                          │─────────────────────────►│
     │                          │                          │                          │
     │                          │                          │                          │ 5. Detect
     │                          │                          │                          │    target
     │                          │                          │                          │    lang: "ja"
     │                          │                          │                          │
     │                          │                          │                          │ 6. Translate
     │                          │                          │                          │    vi → ja
     │                          │                          │                          │    (ONNX Plugin)
     │                          │                          │                          │
     │                          │                          │                          │ 7. Display:
     │                          │                          │                          │    "こんにちは"
     │                          │                          │                          │    (Original:
     │                          │                          │                          │     "Xin chào")
```

### 5. Chi Tiết Luồng Dịch Thuật Trên Client

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT-SIDE TRANSLATION FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Nhận tin nhắn từ Server                                                 │
│     ┌──────────────────────────────────────────┐                           │
│     │ {                                        │                           │
│     │   messageId: "msg_123",                  │                           │
│     │   text: "Xin chào",                      │                           │
│     │   sourceLang: "vi",                      │                           │
│     │   senderId: "user_456",                  │                           │
│     │   timestamp: 1703750400000               │                           │
│     │ }                                        │                           │
│     └──────────────────────────────────────────┘                           │
│                           │                                                 │
│                           ▼                                                 │
│  2. Kiểm tra ngôn ngữ                                                       │
│     ┌──────────────────────────────────────────┐                           │
│     │ sourceLang === userLang ?                │                           │
│     │   → YES: Hiển thị nguyên gốc             │                           │
│     │   → NO:  Tiến hành dịch                  │                           │
│     └──────────────────────────────────────────┘                           │
│                           │ NO                                              │
│                           ▼                                                 │
│  3. Gọi Plugin dịch thuật                                                   │
│     ┌──────────────────────────────────────────┐                           │
│     │ Small100OnnxTranslator.translate({       │                           │
│     │   text: "Xin chào",                      │                           │
│     │   sourceLang: "vi",                      │                           │
│     │   targetLang: "ja"                       │                           │
│     │ })                                       │                           │
│     └──────────────────────────────────────────┘                           │
│                           │                                                 │
│                           ▼                                                 │
│  4. Hiển thị kết quả                                                        │
│     ┌──────────────────────────────────────────┐                           │
│     │ Bản dịch: "こんにちは"                    │                           │
│     │ Bản gốc:  "Xin chào"                     │                           │
│     │ Từ: User A                               │                           │
│     └──────────────────────────────────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cấu Trúc Dữ Liệu

### Server Data Models

```python
# User Model
class User:
    id: str              # UUID
    name: str            # Tên hiển thị
    language: str        # Mã ngôn ngữ (vi, en, ja, zh, ko, ...)
    websocket: WebSocket # WebSocket connection
    room_id: str | None  # ID phòng đang tham gia

# Room Model
class Room:
    id: str              # UUID
    code: str            # Mã phòng 6 ký tự (để join)
    name: str            # Tên phòng
    host_id: str         # ID của người tạo phòng
    members: List[str]   # Danh sách user IDs
    messages: List[Message]
    created_at: datetime
    
# Message Model
class Message:
    id: str              # UUID
    room_id: str         # ID phòng
    sender_id: str       # ID người gửi
    text: str            # Nội dung gốc
    source_lang: str     # Ngôn ngữ gốc
    timestamp: datetime
```

### WebSocket Message Types

```typescript
// Client → Server
type ClientMessage = 
  | { type: 'CREATE_ROOM', roomName: string, hostName: string, language: string }
  | { type: 'JOIN_ROOM', roomCode: string, userName: string, language: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'SEND_MESSAGE', text: string }
  | { type: 'UPDATE_PROFILE', name?: string, language?: string }
  | { type: 'GET_ROOM_INFO' }

// Server → Client
type ServerMessage =
  | { type: 'CONNECTED', userId: string }
  | { type: 'ROOM_CREATED', roomId: string, roomCode: string }
  | { type: 'ROOM_JOINED', room: RoomInfo, members: Member[] }
  | { type: 'USER_JOINED', user: Member }
  | { type: 'USER_LEFT', userId: string, userName: string }
  | { type: 'NEW_MESSAGE', message: Message }
  | { type: 'ROOM_INFO', room: RoomInfo, members: Member[] }
  | { type: 'ERROR', code: string, message: string }
```

## API Endpoints

### HTTP Endpoints (REST)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/rooms/{code}` | Lấy thông tin phòng (public info) |

### WebSocket Endpoint

| Endpoint | Description |
|----------|-------------|
| `ws://server/ws` | WebSocket connection cho real-time chat |

## Supported Languages

Plugin Small100 hỗ trợ 100+ ngôn ngữ, các ngôn ngữ phổ biến:

| Code | Language |
|------|----------|
| vi | Tiếng Việt |
| en | English |
| ja | 日本語 |
| zh | 中文 |
| ko | 한국어 |
| fr | Français |
| de | Deutsch |
| es | Español |
| th | ไทย |
| id | Bahasa Indonesia |

## Cấu Trúc Project

```
demo-chat/
├── FLOW_DESCRIPTION.md      # File này
├── app/                     # React App (Capacitor)
│   ├── src/
│   │   ├── components/      # UI Components
│   │   ├── pages/           # Route Pages
│   │   ├── hooks/           # Custom Hooks
│   │   ├── services/        # API & WebSocket
│   │   ├── store/           # State Management
│   │   └── utils/           # Utilities
│   ├── capacitor.config.ts
│   └── package.json
└── server/                  # Python Server
    ├── main.py              # FastAPI entry point
    ├── models.py            # Data models
    ├── websocket_handler.py # WebSocket logic
    └── requirements.txt
```

## Error Handling

### Client Errors
- `INVALID_ROOM_CODE`: Mã phòng không tồn tại
- `ROOM_FULL`: Phòng đã đầy
- `NOT_IN_ROOM`: Chưa tham gia phòng
- `TRANSLATION_FAILED`: Lỗi dịch thuật

### Server Errors
- `CONNECTION_ERROR`: Lỗi kết nối
- `INTERNAL_ERROR`: Lỗi server

## Security Considerations

1. **WebSocket Authentication**: Sử dụng token-based auth
2. **Room Access**: Chỉ members mới nhận được messages
3. **Rate Limiting**: Giới hạn số message/phút
4. **Input Validation**: Sanitize tất cả user input

## Future Improvements

1. **Persistent Storage**: Database cho lưu trữ lâu dài
2. **Push Notifications**: Thông báo khi có tin nhắn mới
3. **File Sharing**: Chia sẻ hình ảnh, file
4. **Voice Messages**: Tin nhắn thoại
5. **Message History**: Lịch sử tin nhắn
