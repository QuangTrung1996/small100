import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import {
  wsService,
  isNewMessageMessage,
  isUserJoinedMessage,
  isUserLeftMessage,
  isErrorMessage,
} from "../services/websocketService";
import Header from "../components/Header";
import Button from "../components/Button";
import MessageBubble from "../components/MessageBubble";
import MembersList from "../components/MembersList";
import {
  SendIcon,
  UsersIcon,
  ClipboardIcon,
  CheckIcon,
} from "../components/icons";

export default function ChatRoomPage() {
  const navigate = useNavigate();
  const { roomCode: _roomCode } = useParams<{ roomCode: string }>();
  const {
    currentRoom,
    members,
    messages,
    settings,
    userId,
    addMessage,
    addMember,
    removeMember,
    updateMember,
    clearRoom,
    translateMessage,
  } = useAppStore();

  const [inputText, setInputText] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debugEndRef = useRef<HTMLDivElement>(null);

  // Add debug log helper
  const addLog = useCallback((log: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev.slice(-50), `[${timestamp}] ${log}`]);
  }, []);

  // Scroll debug to bottom
  useEffect(() => {
    debugEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debugLogs]);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle incoming messages
  useEffect(() => {
    addLog(`My language: ${settings.language}`);

    const unsubscribe = wsService.onMessage(async (message) => {
      if (isNewMessageMessage(message)) {
        const newMessage = message.message;

        // Debug log
        addLog(`📩 Received: "${newMessage.text}"`);
        addLog(`   From: ${newMessage.senderName} (${newMessage.sourceLang})`);
        addLog(`   My lang: ${settings.language}`);
        addLog(
          `   Need translate: ${newMessage.sourceLang !== settings.language}`
        );

        // Translate if different language
        if (newMessage.sourceLang !== settings.language) {
          addLog(
            `🔄 Translating ${newMessage.sourceLang} → ${settings.language}...`
          );
          const translated = await translateMessage(
            newMessage.text,
            newMessage.sourceLang
          );
          addLog(`✅ Result: "${translated}"`);
          addMessage({ ...newMessage, translatedText: translated });
        } else {
          addLog(`⏭️ Same language, skip translation`);
          addMessage(newMessage);
        }
      } else if (isUserJoinedMessage(message)) {
        addLog(
          `👤 User joined: ${message.user.name} (${message.user.language})`
        );
        if (message.isUpdate) {
          updateMember(message.user);
        } else {
          addMember(message.user);
        }
      } else if (isUserLeftMessage(message)) {
        addLog(`👋 User left: ${message.userId}`);
        removeMember(message.userId);
      } else if (isErrorMessage(message)) {
        addLog(`❌ Error: ${message.message}`);
      }
    });

    const unsubscribeConnection = wsService.onConnectionChange((connected) => {
      if (!connected) {
        // Connection lost
        navigate("/");
      }
    });

    return () => {
      unsubscribe();
      unsubscribeConnection();
    };
  }, [
    settings.language,
    addMessage,
    addMember,
    removeMember,
    updateMember,
    translateMessage,
    navigate,
    addLog,
  ]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    wsService.sendMessage(text);
    setInputText("");
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLeave = () => {
    wsService.leaveRoom();
    wsService.disconnect();
    clearRoom();
    navigate("/");
  };

  const copyRoomCode = async () => {
    if (currentRoom?.code) {
      await navigator.clipboard.writeText(currentRoom.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Get language display name
  const myLangDisplay = settings.language.toUpperCase();

  if (!currentRoom) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">Room not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <Header
        title={`${currentRoom.name} (${myLangDisplay})`}
        showBack
        onBack={handleLeave}
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-1 px-2 py-1 bg-primary-700 rounded text-sm"
              title="Copy room code"
            >
              {copied ? (
                <CheckIcon className="w-4 h-4" />
              ) : (
                <ClipboardIcon className="w-4 h-4" />
              )}
              <span>{currentRoom.code}</span>
            </button>
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="p-2 rounded-full hover:bg-primary-700 transition-colors relative"
            >
              <UsersIcon className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-white text-primary-600 text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {members.length}
              </span>
            </button>
          </div>
        }
      />

      {/* Members Panel */}
      {showMembers && (
        <MembersList
          members={members}
          currentUserId={userId || ""}
          onClose={() => setShowMembers(false)}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <p>No messages yet</p>
            <p className="text-sm">Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === userId}
              userLanguage={settings.language}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t p-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <Button
          onClick={handleSend}
          disabled={!inputText.trim()}
          className="rounded-full w-10 h-10 !p-0"
        >
          <SendIcon className="w-5 h-5" />
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

      {/* Show Debug Button */}
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
