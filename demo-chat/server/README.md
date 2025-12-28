# Chat Server

Python WebSocket server cho Translation Chat App.

## Cài đặt

```bash
pip install -r requirements.txt
```

## Chạy server

```bash
python main.py
```

Hoặc:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### HTTP

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Server info |
| GET | `/api/health` | Health check |
| GET | `/api/languages` | Supported languages |
| GET | `/api/rooms/{code}` | Room public info |
| GET | `/api/stats` | Server statistics |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/ws` | WebSocket connection |

## Configuration

Server chạy mặc định tại `http://localhost:8000`.

Để thay đổi port, sửa trong `main.py`:

```python
uvicorn.run("main:app", host="0.0.0.0", port=YOUR_PORT, reload=True)
```

## Production Deployment

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

Hoặc sử dụng Docker:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```
