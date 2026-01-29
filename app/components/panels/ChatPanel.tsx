"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { playNotificationSound } from "../../lib/utils";

type ChatMessage = {
  id: string;
  userName: string;
  text: string;
  timestamp: number;
};

type ChatPanelProps = {
  socketReady: boolean;
  userName: string;
  players: Array<{ name: string; connected: boolean; observer?: boolean }>;
  onSendMessage: (text: string, userName: string, isReaction?: boolean) => void;
  messages: ChatMessage[];
  chatMutedUntil: number;
  reactionsDisabled: boolean;
  soundMuted: boolean;
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
  { text: "Wololo", emoji: "🙏", animation: "pulse", soundUrl: "/assets/sfx/wololo.mp3" },
  { text: "EZ", emoji: "😎", animation: "shake" },
  { text: "Dive Deep Win Big", emoji: "🔥", animation: "glow", soundUrl: "/assets/sfx/troy-dive-deep-win-big.mp4" },
  { text: "Start the game already!", emoji: "🚀", animation: "bounce", soundUrl: "/assets/sfx/start-the-game.mp3" },
  { text: "Nice one brother", emoji: "💯", animation: "pulse", soundUrl: "/assets/sfx/niceonebrother.mp3" },
  { text: "SHEESH", emoji: "😤", animation: "shake", soundUrl: "/assets/sfx/mads-sheesh.mp4" },
  { text: "Get rekt motherfucker", emoji: "🤬", animation: "glow", soundUrl: "/assets/sfx/get-rekt.ogg" },
];

// Render chat message with markdown and @mentions
function ChatMessageContent({
  text,
  players,
  currentUserName,
  isReaction = false,
  soundMuted,
}: {
  text: string;
  players: Array<{ name: string; connected: boolean }>;
  currentUserName: string;
  isReaction?: boolean;
  soundMuted: boolean;
}) {
  const playerNames = players.map(p => typeof p === 'string' ? p : p.name);
  const previousMentionedRef = useRef(false);
  
  // Check if current user is mentioned
  // Try to match against all player names (including those with spaces)
  const mentions: string[] = [];
  for (const playerName of playerNames) {
    // Check if this player name appears in the text as a mention
    const mentionPattern = new RegExp(`@${playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$|[^\\w])`, 'gi');
    if (mentionPattern.test(text)) {
      if (playerName.toLowerCase() === currentUserName.toLowerCase()) {
        mentions.push(playerName);
      }
    }
  }
  const isMentioned = mentions.length > 0;
  
  // Play sound when user is mentioned (only once per message)
  useEffect(() => {
    if (isMentioned && !previousMentionedRef.current) {
      if (!soundMuted) {
        playNotificationSound();
      }
      previousMentionedRef.current = true;
    } else if (!isMentioned) {
      previousMentionedRef.current = false;
    }
  }, [isMentioned, soundMuted, text]);

  // Process text to replace @mentions with markdown-compatible format
  // Match against all player names (including those with spaces)
  let processedText = text;
  // Sort by length (longest first) to match longer names before shorter ones
  const sortedPlayerNames = [...playerNames].sort((a, b) => b.length - a.length);
  for (const playerName of sortedPlayerNames) {
    // Escape special regex characters in the player name
    const escapedName = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match @ followed by the exact player name, followed by space, end of string, or non-word character
    const mentionRegex = new RegExp(`@${escapedName}(?=\\s|$|[^\\w])`, 'gi');
    processedText = processedText.replace(mentionRegex, `[@${playerName}](mention:${playerName})`);
  }

  // For reactions, wrap each character in a span for sparkle effect
  const renderReactionText = (text: string) => {
    // Split text into parts: emoji, reaction text, and any other content
    const parts: Array<{ type: 'emoji' | 'text' | 'space'; content: string; index: number }> = [];
    let currentIndex = 0;
    
    // Extract emoji (simple check for emoji at start)
    const emojiRegex = /^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    if (text.match(emojiRegex)) {
      const emojiMatch = text.match(/^[\s\S]*?[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}][\s\S]*?/u);
      if (emojiMatch) {
        const emojiEnd = emojiMatch[0].length;
        parts.push({ type: 'emoji', content: text.slice(0, emojiEnd), index: currentIndex });
        currentIndex = emojiEnd;
      }
    }
    
    // Process remaining text character by character
    const remainingText = text.slice(currentIndex);
    const chars = Array.from(remainingText);
    chars.forEach((char, i) => {
      if (char === ' ') {
        parts.push({ type: 'space', content: ' ', index: currentIndex + i });
      } else {
        parts.push({ type: 'text', content: char, index: currentIndex + i });
      }
    });
    
    return (
      <span className="reaction-sparkle-wrapper">
        {parts.map((part, idx) => {
          if (part.type === 'space') {
            return <span key={idx}>&nbsp;</span>;
          }
          if (part.type === 'emoji') {
            return <span key={idx} className="reaction-emoji-display">{part.content}</span>;
          }
          return (
            <span
              key={idx}
              className="reaction-sparkle-char"
              style={{ '--i': idx } as React.CSSProperties}
            >
              {part.content}
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <span className={`chat-text ${isMentioned ? 'chat-mentioned' : ''} ${isReaction ? 'chat-reaction-text' : ''}`}>
      {isReaction ? (
        renderReactionText(text)
      ) : (
        <ReactMarkdown
          components={{
            p: (props) => <span {...props} />,
            strong: (props) => <strong {...props} />,
            em: (props) => <em {...props} />,
            code: (props) => {
              const { inline, ...rest } = props as React.HTMLAttributes<HTMLElement> & {
                inline?: boolean;
              };
              return inline ? <code {...rest} /> : null;
            },
            a: (props) => {
              if (props.href?.startsWith('mention:')) {
                const mentionedUser = props.href.replace('mention:', '');
                return (
                  <span
                    className="chat-mention chat-mention-pill"
                    style={playerStyle(mentionedUser)}
                  >
                    @{mentionedUser}
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
      )}
    </span>
  );
}

export default function ChatPanel({
  socketReady,
  userName,
  players,
  onSendMessage,
  messages,
  chatMutedUntil,
  reactionsDisabled,
  soundMuted,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [reactionCooldownUntil, setReactionCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const reactionsRef = useRef<HTMLDivElement>(null);
  const playedReactionIdsRef = useRef<Set<string>>(new Set());
  const hasMountedRef = useRef(false);

  const playReactionSound = useCallback((soundUrl: string) => {
    if (typeof window === "undefined") return;
    if (soundMuted) return;
    const audio = new Audio(soundUrl);
    audio.volume = 0.5;
    audio.play().catch(() => null);
  }, [soundMuted]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < 72;
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!messages.length) return;
    const activeIds = new Set(messages.map((message) => message.id));
    // Clean up old ids to avoid unbounded growth
    for (const id of playedReactionIdsRef.current) {
      if (!activeIds.has(id)) {
        playedReactionIdsRef.current.delete(id);
      }
    }
    // Only play for the newest message, and only if it wasn't already seen
    const latest = messages[messages.length - 1];
    if (!latest || playedReactionIdsRef.current.has(latest.id)) return;
    const reactionMatch = PRESET_REACTIONS.find(
      (reaction) =>
        latest.text.includes(reaction.emoji) &&
        latest.text.includes(reaction.text)
    );
    if (reactionMatch?.soundUrl) {
      playedReactionIdsRef.current.add(latest.id);
      playReactionSound(reactionMatch.soundUrl);
    }
  }, [messages, playReactionSound]);

  const isTimedOut = chatMutedUntil > now;
  const shouldTick = showReactions || reactionCooldownUntil > now || isTimedOut;

  useEffect(() => {
    if (!shouldTick) return;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => window.clearInterval(interval);
  }, [shouldTick]);

  // Close reactions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (reactionsRef.current && !reactionsRef.current.contains(event.target as Node)) {
        setShowReactions(false);
      }
    }
    if (showReactions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showReactions]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || !socketReady || !userName.trim()) {
      return;
    }
    if (isTimedOut) {
      setError("You are timed out from chat.");
      setTimeout(() => setError(null), 3000);
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
    if (isTimedOut || reactionsDisabled || now < reactionCooldownUntil) {
      return;
    }
    const message = `${reaction.emoji} ${reaction.text}`;
    if (socketReady && userName.trim()) {
      onSendMessage(message, userName, true);
    }
    setReactionCooldownUntil(now + 15000);
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
    if (!players || players.length === 0) return [];
    
    const search = query.slice(1).toLowerCase().trim();
    const currentUserLower = userName.toLowerCase();
    
    // Helper to get player name
    const getPlayerName = (p: { name: string; connected: boolean } | string): string => {
      return typeof p === 'string' ? p : p.name;
    };
    
    if (search.length === 0) {
      // Show all players if just @ is typed (excluding current user)
      return players
        .map(getPlayerName)
        .filter(name => name.toLowerCase() !== currentUserLower)
        .slice(0, 5);
    }
    
    // Filter by search term - now supports partial matches including spaces
    // This allows matching "john d" against "john doe"
    return players
      .map(getPlayerName)
      .filter(name => {
        const nameLower = name.toLowerCase();
        // Check if the search string matches the start of the name
        // This works for both single-word and multi-word names
        return nameLower.startsWith(search) && nameLower !== currentUserLower;
      })
      .slice(0, 5);
  }

  const { mentionSuggestions, showMentions } = (() => {
    const lastAt = inputText.lastIndexOf('@');
    if (lastAt === -1) {
      return { mentionSuggestions: [], showMentions: false };
    }
    // Get text after the @ symbol
    const afterAt = inputText.slice(lastAt + 1);
    
    // For usernames with spaces, we need to be smarter about where the mention ends
    // Don't stop at the first space - instead, check if what's typed matches the start of any player name
    // We'll show suggestions as long as the typed text could be part of a player name
    const queryPart = afterAt;
    const query = `@${queryPart}`;
    
    const suggestions = getMentionSuggestions(query);
    return {
      mentionSuggestions: suggestions,
      showMentions: suggestions.length > 0 || queryPart.trim().length === 0,
    };
  })();

  function handleMentionSelect(name: string) {
    const lastAt = inputText.lastIndexOf('@');
    if (lastAt !== -1) {
      const before = inputText.slice(0, lastAt);
      const after = inputText.slice(lastAt);
      const spaceAfter = after.indexOf(' ');
      const rest = spaceAfter === -1 ? '' : after.slice(spaceAfter);
      setInputText(`${before}@${name}${rest}`);
    }
  }

  return (
    <div className="panel-block chat-panel">
      <div className="panel-header" style={{ alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Chat</h3>
      </div>
      {isTimedOut && (
        <p className="subtle" style={{ marginTop: "6px" }}>
          You are timed out from chat for {Math.ceil((chatMutedUntil - now) / 1000)}s.
        </p>
      )}
      {reactionsDisabled && !isTimedOut && (
        <p className="subtle" style={{ marginTop: "6px" }}>
          Reactions are disabled for you.
        </p>
      )}
      <div className="chat-messages" ref={messagesContainerRef}>
        {!messages || messages.length === 0 ? (
          <p className="subtle">No messages yet. Start the conversation!</p>
        ) : (() => {
          // Find all reaction messages and get the most recent 3
          const reactionMessages = new Set<string>();
          const reactionIndices: number[] = [];
          
          messages.forEach((message, index) => {
            const reactionMatch = PRESET_REACTIONS.find(r => 
              message.text.includes(r.emoji) && message.text.includes(r.text)
            );
            if (reactionMatch) {
              reactionIndices.push(index);
            }
          });
          
          // Get the last 3 reaction indices (most recent)
          const recentReactionIndices = reactionIndices.slice(-3);
          recentReactionIndices.forEach(index => {
            reactionMessages.add(messages[index].id);
          });
          
          return messages.map((message) => {
            // Check if message contains a reaction
            const reactionMatch = PRESET_REACTIONS.find(r => 
              message.text.includes(r.emoji) && message.text.includes(r.text)
            );
            const reactionClass = reactionMatch ? `reaction-${reactionMatch.animation}` : '';
            // Only apply sparkle effect to most recent 3 reactions
            const isReaction = !!reactionMatch && reactionMessages.has(message.id);
            
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
                  isReaction={isReaction}
                  soundMuted={soundMuted}
                />
                <span className="chat-time">{formatTime(message.timestamp)}</span>
              </div>
            );
          });
        })()}
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
              disabled={!socketReady || !userName.trim() || isTimedOut}
              maxLength={500}
              className="chat-input"
              autoFocus={false}
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
              disabled={!socketReady || !userName.trim() || isTimedOut || reactionsDisabled}
              title="Quick reactions"
            >
              😀
            </button>
            <button
              type="submit"
              disabled={!socketReady || !userName.trim() || !inputText.trim() || isTimedOut}
              className="chat-send-button"
            >
              Send
            </button>
          </div>
        </form>
        {showReactions && (
          <div className="chat-reactions" ref={reactionsRef}>
            {reactionCooldownUntil > now && (
              <div className="reaction-cooldown-overlay">
                <div className="reaction-cooldown-text">
                  {Math.ceil((reactionCooldownUntil - now) / 1000)}s
                </div>
              </div>
            )}
            {PRESET_REACTIONS.map((reaction, index) => (
              <button
                key={index}
                type="button"
                className={`chat-reaction-item reaction-${reaction.animation}`}
                onClick={() => handleReactionClick(reaction)}
                title={reaction.text}
                disabled={reactionCooldownUntil > now || isTimedOut || reactionsDisabled}
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
