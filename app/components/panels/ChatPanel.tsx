"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

type ChatMessage = {
  id: string;
  userName: string;
  text: string;
  timestamp: number;
};

type ChatPanelProps = {
  socketReady: boolean;
  userName: string;
  players: Array<{ name: string; connected: boolean }>;
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

// Preset gamer reactions
const PRESET_REACTIONS = [
  { text: "GG", emoji: "👏", animation: "bounce" },
  { text: "WP", emoji: "🎯", animation: "pulse" },
  { text: "EZ", emoji: "😎", animation: "shake" },
  { text: "CLUTCH", emoji: "🔥", animation: "glow" },
  { text: "LETS GO", emoji: "🚀", animation: "bounce" },
  { text: "NICE", emoji: "💯", animation: "pulse" },
  { text: "SHEESH", emoji: "😤", animation: "shake" },
  { text: "BET", emoji: "✅", animation: "glow" },
];

// Render chat message with markdown and @mentions
function ChatMessageContent({ text, players, currentUserName }: { text: string; players: Array<{ name: string; connected: boolean }>; currentUserName: string }) {
  const playerNames = players.map(p => p.name);
  
  // Check if current user is mentioned
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionedUser = match[1];
    const player = playerNames.find(name => name.toLowerCase() === mentionedUser.toLowerCase());
    if (player && player.toLowerCase() === currentUserName.toLowerCase()) {
      mentions.push(player);
    }
  }
  const isMentioned = mentions.length > 0;

  // Process text to replace @mentions with markdown-compatible format
  const processedText = text.replace(/@(\w+)/g, (match, username) => {
    const player = playerNames.find(name => name.toLowerCase() === username.toLowerCase());
    if (player) {
      return `[@${player}](mention:${player})`;
    }
    return match;
  });

  return (
    <span className={`chat-text ${isMentioned ? 'chat-mentioned' : ''}`}>
      <ReactMarkdown
        components={{
          p: ({ node, ...props }) => <span {...props} />,
          strong: ({ node, ...props }) => <strong {...props} />,
          em: ({ node, ...props }) => <em {...props} />,
          code: ({ node, inline, ...props }) => inline ? (
            <code {...props} />
          ) : null,
          a: ({ node, ...props }: any) => {
            if (props.href?.startsWith('mention:')) {
              const mentionedUser = props.href.replace('mention:', '');
              return (
                <span
                  className="chat-mention"
                  style={playerStyle(mentionedUser)}
                >
                  {props.children}
                </span>
              );
            }
            return (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            );
          },
        }}
      >
        {processedText}
      </ReactMarkdown>
    </span>
  );
}

export default function ChatPanel({
  socketReady,
  userName,
  players,
  onSendMessage,
  messages,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const reactionsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close reactions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (reactionsRef.current && !reactionsRef.current.contains(event.target as Node)) {
        setShowReactions(false);
      }
    }
    if (showReactions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showReactions]);

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

  function handleReactionClick(reaction: typeof PRESET_REACTIONS[0]) {
    const message = `${reaction.emoji} ${reaction.text}`;
    if (socketReady && userName.trim()) {
      onSendMessage(message, userName);
    }
    setShowReactions(false);
  }

  function formatTime(timestamp: number) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  // Get autocomplete suggestions for @mentions
  function getMentionSuggestions(query: string): string[] {
    if (!query.startsWith('@')) return [];
    const search = query.slice(1).toLowerCase();
    return players
      .filter(p => p.name.toLowerCase().startsWith(search) && p.name.toLowerCase() !== userName.toLowerCase())
      .map(p => p.name)
      .slice(0, 5);
  }

  const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);

  useEffect(() => {
    const lastAt = inputText.lastIndexOf('@');
    if (lastAt !== -1) {
      const afterAt = inputText.slice(lastAt);
      const spaceAfter = afterAt.indexOf(' ');
      if (spaceAfter === -1 || spaceAfter > 0) {
        const query = spaceAfter === -1 ? afterAt : afterAt.slice(0, spaceAfter);
        const suggestions = getMentionSuggestions(query);
        setMentionSuggestions(suggestions);
        setShowMentions(suggestions.length > 0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, [inputText, players, userName]);

  function handleMentionSelect(name: string) {
    const lastAt = inputText.lastIndexOf('@');
    if (lastAt !== -1) {
      const before = inputText.slice(0, lastAt);
      const after = inputText.slice(lastAt);
      const spaceAfter = after.indexOf(' ');
      const rest = spaceAfter === -1 ? '' : after.slice(spaceAfter);
      setInputText(`${before}@${name}${rest}`);
    }
    setShowMentions(false);
  }

  return (
    <div className="panel-block chat-panel">
      <h3>Chat</h3>
      <div className="chat-messages" ref={messagesContainerRef}>
        {!messages || messages.length === 0 ? (
          <p className="subtle">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((message) => {
            // Check if message contains a reaction
            const reactionMatch = PRESET_REACTIONS.find(r => 
              message.text.includes(r.emoji) && message.text.includes(r.text)
            );
            const reactionClass = reactionMatch ? `reaction-${reactionMatch.animation}` : '';
            
            return (
              <div key={message.id} className={`chat-message ${reactionClass}`}>
                <span
                  className="chat-username"
                  style={playerStyle(message.userName)}
                >
                  {message.userName}
                </span>
                <ChatMessageContent
                  text={message.text}
                  players={players}
                  currentUserName={userName}
                />
                <span className="chat-time">{formatTime(message.timestamp)}</span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      {error && <div className="chat-error">{error}</div>}
      <div className="chat-input-wrapper">
        <form onSubmit={handleSubmit} className="chat-input-form">
          <div className="chat-input-container">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={userName.trim() ? "Type a message... (use @username to tag)" : "Set your name first"}
              disabled={!socketReady || !userName.trim()}
              maxLength={500}
              className="chat-input"
            />
            {showMentions && mentionSuggestions.length > 0 && (
              <div className="chat-mention-suggestions">
                {mentionSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="chat-mention-suggestion"
                    onClick={() => handleMentionSelect(name)}
                    style={playerStyle(name)}
                  >
                    @{name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="chat-actions">
            <button
              type="button"
              className="chat-reaction-button"
              onClick={() => setShowReactions(!showReactions)}
              disabled={!socketReady || !userName.trim()}
              title="Quick reactions"
            >
              😀
            </button>
            <button
              type="submit"
              disabled={!socketReady || !userName.trim() || !inputText.trim()}
              className="chat-send-button"
            >
              Send
            </button>
          </div>
        </form>
        {showReactions && (
          <div className="chat-reactions" ref={reactionsRef}>
            {PRESET_REACTIONS.map((reaction, index) => (
              <button
                key={index}
                type="button"
                className={`chat-reaction-item reaction-${reaction.animation}`}
                onClick={() => handleReactionClick(reaction)}
                title={reaction.text}
              >
                <span className="reaction-emoji">{reaction.emoji}</span>
                <span className="reaction-text">{reaction.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
