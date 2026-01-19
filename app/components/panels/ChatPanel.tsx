"use client";

import { useState, useEffect, useRef } from "react";

type ChatMessage = {
  id: string;
  userName: string;
  text: string;
  timestamp: number;
};

type ChatPanelProps = {
  socketReady: boolean;
  userName: string;
  onSendMessage: (text: string, userName: string) => void;
  messages: ChatMessage[];
};

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function playerStyle(name: string) {
  const hue = hashString(name) % 360;
  return {
    background: `hsla(${hue}, 70%, 60%, 0.18)`,
    borderColor: `hsla(${hue}, 70%, 60%, 0.5)`,
    color: `hsl(${hue}, 80%, 80%)`,
  };
}

export default function ChatPanel({
  socketReady,
  userName,
  onSendMessage,
  messages,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || !socketReady || !userName.trim()) {
      return;
    }

    const trimmedText = inputText.trim();
    if (trimmedText.length === 0 || trimmedText.length > 500) {
      setError("Message must be between 1 and 500 characters");
      setTimeout(() => setError(null), 3000);
      return;
    }

    onSendMessage(trimmedText, userName);
    setInputText("");
    setError(null);
  }

  function formatTime(timestamp: number) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  return (
    <div className="panel-block chat-panel">
      <h3>Chat</h3>
      <div className="chat-messages" ref={messagesContainerRef}>
        {!messages || messages.length === 0 ? (
          <p className="subtle">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="chat-message">
              <span
                className="chat-username"
                style={playerStyle(message.userName)}
              >
                {message.userName}
              </span>
              <span className="chat-text">{message.text}</span>
              <span className="chat-time">{formatTime(message.timestamp)}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      {error && <div className="chat-error">{error}</div>}
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={userName.trim() ? "Type a message..." : "Set your name first"}
          disabled={!socketReady || !userName.trim()}
          maxLength={500}
          className="chat-input"
        />
        <button
          type="submit"
          disabled={!socketReady || !userName.trim() || !inputText.trim()}
          className="chat-send-button"
        >
          Send
        </button>
      </form>
    </div>
  );
}
