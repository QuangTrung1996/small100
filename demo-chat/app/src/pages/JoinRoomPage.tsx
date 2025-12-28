import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import {
  wsService,
  isConnectedMessage,
  isRoomJoinedMessage,
  isErrorMessage,
} from "../services/websocketService";
import Header from "../components/Header";
import Button from "../components/Button";
import Input from "../components/Input";
import LanguageSelector from "../components/LanguageSelector";

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const {
    settings,
    setUserId,
    setConnected,
    setRoom,
    setMembers,
    setMessages,
    clearRoom,
  } = useAppStore();

  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState(settings.userName || "");
  const [language, setLanguage] = useState(settings.language);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Use refs to access current values in callbacks
  const roomCodeRef = useRef(roomCode);
  const userNameRef = useRef(userName);
  const languageRef = useRef(language);

  // Keep refs in sync
  useEffect(() => {
    roomCodeRef.current = roomCode;
    userNameRef.current = userName;
    languageRef.current = language;
  }, [roomCode, userName, language]);

  const handleMessage = useCallback(
    (message: import("../types").ServerMessage) => {
      if (isConnectedMessage(message)) {
        setUserId(message.userId);
        setConnected(true);
        // Use refs to get current values
        wsService.joinRoom(
          roomCodeRef.current.toUpperCase(),
          userNameRef.current,
          languageRef.current
        );
      } else if (isRoomJoinedMessage(message)) {
        setRoom(message.room);
        setMembers(message.members);
        setMessages(message.messages || []);
        setIsLoading(false);
        navigate(`/chat/${message.room.code}`);
      } else if (isErrorMessage(message)) {
        setError(message.message);
        setIsLoading(false);
      }
    },
    [navigate, setUserId, setConnected, setRoom, setMembers, setMessages]
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

  const handleJoin = async () => {
    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }
    if (!userName.trim()) {
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
        title="Join Room"
        showBack
        onBack={() => {
          wsService.disconnect();
          navigate(-1);
        }}
      />

      <div className="flex-1 overflow-auto p-4 space-y-6">
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Join Details</h2>

          <Input
            label="Room Code"
            placeholder="Enter 6-character code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="text-center text-lg tracking-widest font-mono"
          />

          <Input
            label="Your Name"
            placeholder="Enter your name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
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
          <p>Enter the room code shared by the host.</p>
          <p>Messages will be translated to your language.</p>
        </div>
      </div>

      <div className="p-4 bg-white border-t">
        <Button fullWidth loading={isLoading} onClick={handleJoin}>
          Join Room
        </Button>
      </div>
    </div>
  );
}
