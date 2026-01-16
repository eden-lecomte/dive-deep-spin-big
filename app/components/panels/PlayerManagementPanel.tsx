"use client";

import { useState } from "react";

type PlayerManagementPanelProps = {
  players: string[];
  socketReady: boolean;
  adminName: string | null;
  onRenamePlayer: (oldName: string, newName: string) => void;
  onKickPlayer: (playerName: string) => void;
};

export default function PlayerManagementPanel({
  players,
  socketReady,
  adminName,
  onRenamePlayer,
  onKickPlayer,
}: PlayerManagementPanelProps) {
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  function handleStartEdit(playerName: string) {
    setEditingPlayer(playerName);
    setNewName(playerName);
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

  return (
    <div className="panel-block">
      <h3>Player Management</h3>
      {players.length === 0 ? (
        <p className="subtle">No players in room.</p>
      ) : (
        <div className="player-management-list">
          {players.map((playerName) => (
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
                  <span className="player-name">{playerName}</span>
                  <div className="player-actions">
                    <button
                      className="ghost"
                      onClick={() => handleStartEdit(playerName)}
                      disabled={!socketReady}
                    >
                      Rename
                    </button>
                    <button
                      className="ghost danger"
                      onClick={() => onKickPlayer(playerName)}
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
                          : undefined
                      }
                    >
                      Kick
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
