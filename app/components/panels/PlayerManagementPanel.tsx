"use client";

import { useState, useEffect } from "react";

type PlayerManagementPanelProps = {
  players: Array<{ name: string; connected: boolean }>;
  socketReady: boolean;
  adminName: string | null;
  playerStats: Record<string, { wins: number; losses: number }>;
  onRenamePlayer: (oldName: string, newName: string) => void;
  onKickPlayer: (playerName: string) => void;
  onAwardWin: (playerName: string) => void;
  onAwardLoss: (playerName: string) => void;
  onResetStats: (playerName: string) => void;
};

export default function PlayerManagementPanel({
  players,
  socketReady,
  adminName,
  playerStats,
  onRenamePlayer,
  onKickPlayer,
  onAwardWin,
  onAwardLoss,
  onResetStats,
}: PlayerManagementPanelProps) {
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [pendingKick, setPendingKick] = useState<string | null>(null);
  const [pendingReset, setPendingReset] = useState<string | null>(null);

  function handleStartEdit(playerName: string) {
    setEditingPlayer(playerName);
    setNewName(playerName);
    setPendingKick(null);
    setPendingReset(null);
  }

  function handleCancelEdit() {
    setEditingPlayer(null);
    setNewName("");
  }

  function handleSaveEdit() {
    if (!editingPlayer || !newName.trim() || newName.trim() === editingPlayer) {
      handleCancelEdit();
      return;
    }
    onRenamePlayer(editingPlayer, newName.trim());
    handleCancelEdit();
  }

  function handleKickClick(playerName: string) {
    if (pendingKick === playerName) {
      // Second click - confirm
      onKickPlayer(playerName);
      setPendingKick(null);
    } else {
      // First click - set pending
      setPendingKick(playerName);
      setPendingReset(null); // Clear other pending actions
    }
  }

  function handleResetClick(playerName: string) {
    if (pendingReset === playerName) {
      // Second click - confirm
      onResetStats(playerName);
      setPendingReset(null);
    } else {
      // First click - set pending
      setPendingReset(playerName);
      setPendingKick(null); // Clear other pending actions
    }
  }

  // Reset pending kick after 5 seconds
  useEffect(() => {
    if (pendingKick) {
      const timer = setTimeout(() => {
        setPendingKick(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingKick]);

  // Reset pending reset after 5 seconds
  useEffect(() => {
    if (pendingReset) {
      const timer = setTimeout(() => {
        setPendingReset(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingReset]);

  // Reset pending kick after 5 seconds
  useEffect(() => {
    if (pendingKick) {
      const timer = setTimeout(() => {
        setPendingKick(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingKick]);

  // Reset pending reset after 5 seconds
  useEffect(() => {
    if (pendingReset) {
      const timer = setTimeout(() => {
        setPendingReset(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingReset]);

  // Clear pending kick when player is removed
  useEffect(() => {
    if (pendingKick && !players.some(p => p.name === pendingKick)) {
      setPendingKick(null);
    }
  }, [players, pendingKick]);

  // Clear pending reset when player is removed
  useEffect(() => {
    if (pendingReset && !players.some(p => p.name === pendingReset)) {
      setPendingReset(null);
    }
  }, [players, pendingReset]);

  return (
    <div className="panel-block">
      <h3>Player Management</h3>
      {players.length === 0 ? (
        <p className="subtle">No players in room.</p>
      ) : (
        <div className="player-management-list">
          {players.map((player) => {
            const playerName = player.name;
            return (
              <div key={playerName} className="player-management-item">
                {editingPlayer === playerName ? (
                  <div className="player-edit-form">
                    <input
                      type="text"
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          handleSaveEdit();
                        } else if (event.key === "Escape") {
                          handleCancelEdit();
                        }
                      }}
                      placeholder="New name"
                      autoFocus
                    />
                    <button
                      className="primary"
                      onClick={handleSaveEdit}
                      disabled={!newName.trim() || newName.trim() === editingPlayer}
                    >
                      Save
                    </button>
                    <button className="ghost" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="player-management-row">
                    <span className="player-name">
                      <span className={`connection-indicator ${player.connected ? "connected" : "disconnected"}`} title={player.connected ? "Connected" : "Disconnected"} />
                      {playerName}
                      {playerStats[playerName] && (
                        <span className="player-stats">
                          {" "}({playerStats[playerName].wins}W / {playerStats[playerName].losses}L)
                        </span>
                      )}
                    </span>
                    <div className="player-actions">
                      <button
                        className="ghost win-button"
                        onClick={() => onAwardWin(playerName)}
                        disabled={!socketReady}
                        title="Award win"
                      >
                        🏆
                      </button>
                      <button
                        className="ghost loss-button"
                        onClick={() => onAwardLoss(playerName)}
                        disabled={!socketReady}
                        title="Award loss"
                      >
                        💀
                      </button>
                      <button
                        className={`ghost ${pendingReset === playerName ? "danger" : ""}`}
                        onClick={() => handleResetClick(playerName)}
                        disabled={!socketReady || !playerStats[playerName] || (playerStats[playerName].wins === 0 && playerStats[playerName].losses === 0)}
                        title={pendingReset === playerName ? "Click again to confirm reset" : "Reset stats"}
                      >
                        {pendingReset === playerName ? "Confirm ↻" : "↻"}
                      </button>
                      <button
                        className="ghost"
                        onClick={() => handleStartEdit(playerName)}
                        disabled={!socketReady}
                      >
                        Rename
                      </button>
                      <button
                        className={`ghost danger ${pendingKick === playerName ? "pending-confirm" : ""}`}
                        onClick={() => handleKickClick(playerName)}
                        disabled={
                          !socketReady ||
                          (adminName &&
                            playerName.trim().toLowerCase() ===
                              adminName.trim().toLowerCase())
                        }
                        title={
                          adminName &&
                          playerName.trim().toLowerCase() ===
                            adminName.trim().toLowerCase()
                            ? "Cannot kick yourself"
                            : pendingKick === playerName
                            ? "Click again to confirm kick"
                            : "Kick player"
                        }
                      >
                        {pendingKick === playerName ? "Confirm Kick" : "Kick"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
