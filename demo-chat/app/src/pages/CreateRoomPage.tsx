import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import {
  wsService,
  isConnectedMessage,
  isRoomCreatedMessage,
  isErrorMessage,
} from "../services/websocketService";
import Header from "../components/Header";
import Button from "../components/Button";
import Input from "../components/Input";
import LanguageSelector from "../components/LanguageSelector";

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { settings, setUserId, setConnected, setRoom, setMembers, clearRoom } =
    useAppStore();

  const [roomName, setRoomName] = useState("");
  const [hostName, setHostName] = useState(settings.userName || "");
  const [language, setLanguage] = useState(settings.language);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Use refs to access current values in callbacks
  const roomNameRef = useRef(roomName);
  const hostNameRef = useRef(hostName);
  const languageRef = useRef(language);

  // Keep refs in sync
  useEffect(() => {
    roomNameRef.current = roomName;
    hostNameRef.current = hostName;
    languageRef.current = language;
  }, [roomName, hostName, language]);

  const handleMessage = useCallback(
    (message: import("../types").ServerMessage) => {
      if (isConnectedMessage(message)) {
        setUserId(message.userId);
        setConnected(true);
        // Use refs to get current values
        wsService.createRoom(
          roomNameRef.current,
          hostNameRef.current,
          languageRef.current
        );
      } else if (isRoomCreatedMessage(message)) {
        setRoom(message.room);
        setMembers(message.members);
        setIsLoading(false);
        navigate(`/chat/${message.roomCode}`);
      } else if (isErrorMessage(message)) {
        setError(message.message);
        setIsLoading(false);
      }
    },
    [navigate, setUserId, setConnected, setRoom, setMembers]
  );

  const handleConnectionChange = useCallback(
    (connected: boolean) => {
      setConnected(connected);
      if (!connected) {
        setIsLoading(false);
        setError("Connection lost. Please try again.");
      }
    },
    [setConnected]
  );

  useEffect(() => {
    const unsubscribe = wsService.onMessage(handleMessage);
    const unsubscribeConnection = wsService.onConnectionChange(
      handleConnectionChange
    );

    return () => {
      unsubscribe();
      unsubscribeConnection();
    };
  }, [handleMessage, handleConnectionChange]);

  const handleCreate = async () => {
    if (!roomName.trim()) {
      setError("Please enter a room name");
      return;
    }
    if (!hostName.trim()) {
      setError("Please enter your name");
      return;
    }

    setError("");
    setIsLoading(true);
    clearRoom();

    try {
      // Connect to WebSocket server
      await wsService.connect(settings.serverUrl);
    } catch (err) {
      console.error("Connection error:", err);
      setError("Failed to connect to server. Make sure the server is running.");
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Create Room"
        showBack
        onBack={() => {
          wsService.disconnect();
          navigate(-1);
        }}
      />

      <div className="flex-1 overflow-auto p-4 space-y-6">
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Room Details</h2>

          <Input
            label="Room Name"
            placeholder="Enter room name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />

          <Input
            label="Your Name"
            placeholder="Enter your name"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
          />

          <LanguageSelector
            label="Your Language"
            value={language}
            onChange={setLanguage}
          />
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="text-sm text-gray-500 text-center">
          <p>A unique room code will be generated.</p>
          <p>Share it with others to join your room.</p>
        </div>
      </div>

      <div className="p-4 bg-white border-t">
        <Button fullWidth loading={isLoading} onClick={handleCreate}>
          Create Room
        </Button>
      </div>
    </div>
  );
}
