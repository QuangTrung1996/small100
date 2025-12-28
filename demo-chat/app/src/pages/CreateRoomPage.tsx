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
  const {
    settings,
    saveSettings,
    setUserId,
    setConnected,
    setRoom,
    setMembers,
    clearRoom,
  } = useAppStore();

  const [roomName, setRoomName] = useState("");
  const [hostName, setHostName] = useState(settings.userName || "");
  const [language, setLanguage] = useState(settings.language);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDebug, setShowDebug] = useState(true);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const debugEndRef = useRef<HTMLDivElement>(null);

  // Use refs to access current values in callbacks
  const roomNameRef = useRef(roomName);
  const hostNameRef = useRef(hostName);
  const languageRef = useRef(language);

  // Helper to add debug log
  const addLog = useCallback((log: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev.slice(-50), `[${timestamp}] ${log}`]);
  }, []);

  // Keep refs in sync
  useEffect(() => {
    roomNameRef.current = roomName;
    hostNameRef.current = hostName;
    languageRef.current = language;
  }, [roomName, hostName, language]);

  // Log input changes
  useEffect(() => {
    addLog(`Room name: ${roomName}`);
  }, [roomName]);
  useEffect(() => {
    addLog(`Host name: ${hostName}`);
  }, [hostName]);
  useEffect(() => {
    addLog(`Language: ${language}`);
  }, [language]);

  // Scroll debug to bottom
  useEffect(() => {
    debugEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debugLogs]);

  const handleMessage = useCallback(
    (message: import("../types").ServerMessage) => {
      if (isConnectedMessage(message)) {
        addLog("🟢 Connected to server");
        setUserId(message.userId);
        setConnected(true);
        wsService.createRoom(
          roomNameRef.current,
          hostNameRef.current,
          languageRef.current
        );
      } else if (isRoomCreatedMessage(message)) {
        addLog("🏠 Room created successfully");
        // Save selected language to settings
        saveSettings({
          userName: hostNameRef.current,
          language: languageRef.current,
        });
        setRoom(message.room);
        setMembers(message.members);
        setIsLoading(false);
        navigate(`/chat/${message.roomCode}`);
      } else if (isErrorMessage(message)) {
        addLog(`❌ Error: ${message.message}`);
        setError(message.message);
        setIsLoading(false);
      }
    },
    [
      navigate,
      setUserId,
      setConnected,
      setRoom,
      setMembers,
      addLog,
      saveSettings,
    ]
  );

  const handleConnectionChange = useCallback(
    (connected: boolean) => {
      addLog(connected ? "🟢 Connected" : "🔴 Disconnected");
      setConnected(connected);
      if (!connected) {
        setIsLoading(false);
        setError("Connection lost. Please try again.");
      }
    },
    [setConnected, addLog]
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
    addLog("🔨 Create Room button clicked");
    if (!roomName.trim()) {
      setError("Please enter a room name");
      addLog("⚠️ Missing room name");
      return;
    }
    if (!hostName.trim()) {
      setError("Please enter your name");
      addLog("⚠️ Missing host name");
      return;
    }

    setError("");
    setIsLoading(true);
    clearRoom();

    try {
      addLog(`🌐 Connecting to ${settings.serverUrl}`);
      await wsService.connect(settings.serverUrl);
    } catch (err) {
      addLog("❌ Connection error");
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

      {/* Debug Panel */}
      {showDebug && (
        <div className="bg-gray-900 text-green-400 text-xs font-mono max-h-40 overflow-auto p-2 border-t border-gray-700">
          <div className="flex justify-between items-center mb-1">
            <span className="text-yellow-400 font-bold">🔧 Debug Log</span>
            <div>
              <button
                onClick={() => setDebugLogs([])}
                className="text-gray-400 hover:text-white px-2 mr-1 border border-gray-700 rounded"
                title="Clear log"
              >
                🧹
              </button>
              <button
                onClick={() => setShowDebug(false)}
                className="text-gray-500 hover:text-white px-2"
              >
                ✕
              </button>
            </div>
          </div>
          {debugLogs.length === 0 ? (
            <p className="text-gray-500">No logs yet...</p>
          ) : (
            debugLogs.map((log, i) => (
              <p key={i} className="leading-tight">
                {log}
              </p>
            ))
          )}
          <div ref={debugEndRef} />
        </div>
      )}
      {!showDebug && (
        <button
          onClick={() => setShowDebug(true)}
          className="fixed bottom-20 right-4 bg-gray-800 text-white px-3 py-1 rounded-full text-xs shadow-lg"
        >
          🔧 Debug
        </button>
      )}
    </div>
  );
}
