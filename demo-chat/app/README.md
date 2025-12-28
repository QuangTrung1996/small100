# Translation Chat Demo App

Ứng dụng chat demo sử dụng Small100-ONNX Translator Plugin để dịch tin nhắn realtime.

## Tính năng

- 🏠 **Tạo phòng chat**: Tạo phòng với mã code 6 ký tự
- 🚪 **Tham gia phòng**: Nhập mã code để tham gia
- 💬 **Chat realtime**: Gửi và nhận tin nhắn qua WebSocket
- 🌍 **Dịch tự động**: Tin nhắn tự động dịch sang ngôn ngữ của bạn
- ⚙️ **Cài đặt**: Tùy chỉnh tên và ngôn ngữ
- 📱 **Cross-platform**: Hỗ trợ Web, Android, iOS

## Cài đặt

### 1. Cài đặt dependencies

```bash
cd demo-chat/app
npm install
```

### 2. Chạy development server

```bash
npm run dev
```

Mở http://localhost:3000 trên trình duyệt.

### 3. Build cho production

```bash
npm run build
```

## Chạy Server

### 1. Cài đặt Python dependencies

```bash
cd demo-chat/server
pip install -r requirements.txt
```

### 2. Chạy server

```bash
python main.py
```

Server chạy tại http://localhost:8000

## Build cho Mobile

### Android

```bash
npm run build
npx cap add android  # Lần đầu
npm run cap:sync
npm run cap:android
```

### iOS

```bash
npm run build
npx cap add ios  # Lần đầu
npm run cap:sync
npm run cap:ios
```

## Cấu trúc Project

```
demo-chat/
├── app/                      # React App
│   ├── src/
│   │   ├── components/       # UI Components
│   │   │   ├── Button.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── LanguageSelector.tsx
│   │   │   ├── Layout.tsx
│   │   │   ├── MembersList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── icons.tsx
│   │   ├── pages/            # Route Pages
│   │   │   ├── HomePage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── CreateRoomPage.tsx
│   │   │   ├── JoinRoomPage.tsx
│   │   │   └── ChatRoomPage.tsx
│   │   ├── services/         # API & WebSocket
│   │   │   ├── translatorService.ts
│   │   │   └── websocketService.ts
│   │   ├── store/            # State Management
│   │   │   └── appStore.ts
│   │   ├── types/            # TypeScript Types
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── capacitor.config.ts
│   ├── package.json
│   └── vite.config.ts
├── server/                   # Python Server
│   ├── main.py
│   ├── models.py
│   ├── websocket_handler.py
│   └── requirements.txt
└── FLOW_DESCRIPTION.md       # Mô tả luồng xử lý
```

## API Reference

### WebSocket Messages

#### Client → Server

| Type | Payload | Description |
|------|---------|-------------|
| `CREATE_ROOM` | `{roomName, hostName, language}` | Tạo phòng mới |
| `JOIN_ROOM` | `{roomCode, userName, language}` | Tham gia phòng |
| `LEAVE_ROOM` | - | Rời phòng |
| `SEND_MESSAGE` | `{text}` | Gửi tin nhắn |
| `UPDATE_PROFILE` | `{name?, language?}` | Cập nhật profile |

#### Server → Client

| Type | Payload | Description |
|------|---------|-------------|
| `CONNECTED` | `{userId}` | Kết nối thành công |
| `ROOM_CREATED` | `{roomId, roomCode, room, members}` | Tạo phòng thành công |
| `ROOM_JOINED` | `{room, members, messages}` | Tham gia thành công |
| `NEW_MESSAGE` | `{message}` | Tin nhắn mới |
| `USER_JOINED` | `{user}` | Có người tham gia |
| `USER_LEFT` | `{userId, userName}` | Có người rời đi |
| `ERROR` | `{code, message}` | Lỗi |

## Supported Languages

| Code | Language |
|------|----------|
| vi | Tiếng Việt |
| en | English |
| ja | 日本語 |
| zh | 中文 |
| ko | 한국어 |
| ... | 100+ languages |

## License

MIT
