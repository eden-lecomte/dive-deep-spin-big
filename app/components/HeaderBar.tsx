"use client";

import { useState, useEffect } from "react";

type HeaderBarProps = {
  room: string;
  viewMode: boolean;
  socketReady: boolean;
  votingEnabled: boolean;
  presentationMode: boolean;
  adminActive: boolean;
  adminPopoverOpen: boolean;
  adminPopoverContent: React.ReactNode | null;
  players: Array<{ name: string; connected: boolean }>;
  adminName: string | null;
  onAdminClick: () => void;
  onLeaveRoom: () => void;
  onVotingToggle?: () => void;
  onPresentationToggle?: () => void;
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

export default function HeaderBar({
  room,
  viewMode,
  socketReady,
  votingEnabled,
  presentationMode,
  adminActive,
  adminPopoverOpen,
  adminPopoverContent,
  players,
  adminName,
  onAdminClick,
  onLeaveRoom,
  onVotingToggle,
  onPresentationToggle,
}: HeaderBarProps) {
  const [pendingLeave, setPendingLeave] = useState(false);

  // Sort players to put admin first
  const sortedPlayers = [...players].sort((a, b) => {
    if (!adminName) return 0;
    const aName = typeof a === 'string' ? a : a.name;
    const bName = typeof b === 'string' ? b : b.name;
    const aIsAdmin = aName.trim().toLowerCase() === adminName.trim().toLowerCase();
    const bIsAdmin = bName.trim().toLowerCase() === adminName.trim().toLowerCase();
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;
    return 0;
  });

  function handleLeaveClick() {
    if (pendingLeave) {
      // Second click - confirm
      onLeaveRoom();
      setPendingLeave(false);
    } else {
      // First click - set pending
      setPendingLeave(true);
    }
  }

  // Reset pending leave after 5 seconds
  useEffect(() => {
    if (pendingLeave) {
      const timer = setTimeout(() => {
        setPendingLeave(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingLeave]);

  return (
    <header className="header">
      <div>
        <p className="eyebrow">Spin Room</p>
        <h1>Dive Deep Spin Big</h1>
        <p className="subtle">
          Room: <span className="pill">{room}</span>
        </p>
        {!viewMode && sortedPlayers.length > 0 && (
          <div className="header-players">
            <ul className="players-list-header">
              {sortedPlayers.map((player) => {
                const name = typeof player === 'string' ? player : player.name;
                return (
                <li key={name} className="player-pill" style={playerStyle(name)}>
                  {name}
                  {adminName && name.trim().toLowerCase() === adminName.trim().toLowerCase() && (
                    <span className="admin-crown">👑</span>
                  )}
                </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      {!viewMode && (
        <div className="status-group">
          <button 
            key="leave-room-button"
            className={`ghost ${pendingLeave ? "danger pending-confirm" : ""}`}
            onClick={handleLeaveClick}
            title={pendingLeave ? "Click again to confirm leave" : "Leave room"}
          >
            {pendingLeave ? "Confirm Leave" : "Leave room"}
          </button>
          <div className="admin-wrapper">
            <button className="ghost admin-indicator" onClick={onAdminClick}>
              <span className={`status-dot ${adminActive ? "ok" : "warn"}`} />
              {adminActive ? "Admin active" : "Admin login"}
            </button>
            {adminPopoverOpen && adminPopoverContent}
          </div>
          {adminActive ? (
            <div className="mode-toggle">
              <button
                className={`mode-toggle-option ${votingEnabled && !presentationMode ? "active" : ""}`}
                onClick={() => {
                  // Always call the handler - it will set the correct state
                  onVotingToggle?.();
                }}
              >
                Vote
              </button>
              <div 
                className="mode-toggle-slider" 
                data-mode={presentationMode ? "presentation" : "voting"}
              />
              <button
                className={`mode-toggle-option ${presentationMode ? "active" : ""}`}
                onClick={() => {
                  // Always call the handler - it will set the correct state
                  onPresentationToggle?.();
                }}
              >
                Play
              </button>
            </div>
          ) : (
            <div className="status">
              <span className={`status-dot ${votingEnabled ? "ok" : "warn"}`} />
              {votingEnabled ? "Voting enabled" : "Voting disabled"}
            </div>
          )}
          <div className="status">
            <span className={`status-dot ${socketReady ? "ok" : "warn"}`} />
            {socketReady ? "Connected" : "Offline"}
          </div>
        </div>
      )}
    </header>
  );
}
