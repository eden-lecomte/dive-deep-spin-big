"use client";

import { useEffect, useState } from "react";
import type { TeamState } from "../lib/types";

type TeamsSectionProps = {
  teamState: TeamState | null;
  teamShuffle: boolean;
  adminUnlocked: boolean;
  landedItemLabel?: string | null;
  showControls?: boolean;
  onCreateTeams?: () => void;
  onCreateFreeForAll?: () => void;
  onAwardTeamWin?: (team: string[]) => void;
  onAwardTeamLoss?: (team: string[]) => void;
};

export default function TeamsSection({
  teamState,
  teamShuffle,
  adminUnlocked,
  landedItemLabel,
  showControls = true,
  onCreateTeams,
  onCreateFreeForAll,
  onAwardTeamWin,
  onAwardTeamLoss,
}: TeamsSectionProps) {
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

  const [recentlyAwarded, setRecentlyAwarded] = useState<{
    team: "A" | "B" | string | null;
    type: "win" | "loss" | null;
  }>({ team: null, type: null });

  useEffect(() => {
    if (recentlyAwarded.team && recentlyAwarded.type) {
      const timer = setTimeout(() => {
        setRecentlyAwarded({ team: null, type: null });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [recentlyAwarded]);

  const handleTeamWin = (team: "A" | "B" | string, teamNames: string[]) => {
    setRecentlyAwarded({ team, type: "win" });
    onAwardTeamWin?.(teamNames);
  };

  const handleTeamLoss = (team: "A" | "B" | string, teamNames: string[]) => {
    setRecentlyAwarded({ team, type: "loss" });
    onAwardTeamLoss?.(teamNames);
  };

  return (
    <div className="team-area">
      <div className="team-header">
        <p className="eyebrow">Teams</p>
        {showControls && adminUnlocked && (
          <div style={{ display: "flex", gap: "8px" }}>
            {!teamState && (
              <button className="primary" onClick={onCreateTeams}>
                {landedItemLabel ? `Create teams for ${landedItemLabel}` : "Create teams"}
              </button>
            )}
            <button
              className="ghost"
              onClick={onCreateTeams}
              disabled={!teamState}
              title={teamState ? "Shuffle teams" : "Create teams first"}
            >
              Shuffle teams
            </button>
            <button className="ghost" onClick={onCreateFreeForAll}>
              Free for all
            </button>
          </div>
        )}
      </div>
      {teamState && (
        <div className="team-grid">
          <div className={`team-card ${teamShuffle ? "shuffle" : ""}`}>
            <div className="team-card-header">
              <h3>Team A</h3>
              {showControls && adminUnlocked && (
                <div className="team-actions">
                  <button
                    className={`ghost win-button ${recentlyAwarded.team === "A" && recentlyAwarded.type === "win" ? "recently-awarded" : ""}`}
                    onClick={() => {
                      handleTeamWin("A", teamState.teamA);
                    }}
                    disabled={recentlyAwarded.team === "A" && recentlyAwarded.type === "win"}
                    title="Award win to Team A"
                  >
                    🏆
                  </button>
                  <button
                    className={`ghost loss-button ${recentlyAwarded.team === "A" && recentlyAwarded.type === "loss" ? "recently-awarded" : ""}`}
                    onClick={() => {
                      handleTeamLoss("A", teamState.teamA);
                    }}
                    disabled={recentlyAwarded.team === "A" && recentlyAwarded.type === "loss"}
                    title="Award loss to Team A"
                  >
                    💀
                  </button>
                </div>
              )}
            </div>
            <ul>
              {teamState.teamA.map((name, index) => (
                <li key={`a-${name}-${index}`}>
                  <span className="player-pill team-pill" style={playerStyle(name)}>
                    {name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className={`team-card ${teamShuffle ? "shuffle" : ""}`}>
            <div className="team-card-header">
              <h3>Team B</h3>
              {showControls && adminUnlocked && (
                <div className="team-actions">
                  <button
                    className={`ghost win-button ${recentlyAwarded.team === "B" && recentlyAwarded.type === "win" ? "recently-awarded" : ""}`}
                    onClick={() => {
                      handleTeamWin("B", teamState.teamB);
                    }}
                    disabled={recentlyAwarded.team === "B" && recentlyAwarded.type === "win"}
                    title="Award win to Team B"
                  >
                    🏆
                  </button>
                  <button
                    className={`ghost loss-button ${recentlyAwarded.team === "B" && recentlyAwarded.type === "loss" ? "recently-awarded" : ""}`}
                    onClick={() => {
                      handleTeamLoss("B", teamState.teamB);
                    }}
                    disabled={recentlyAwarded.team === "B" && recentlyAwarded.type === "loss"}
                    title="Award loss to Team B"
                  >
                    💀
                  </button>
                </div>
              )}
            </div>
            <ul>
              {teamState.teamB.map((name, index) => (
                <li key={`b-${name}-${index}`}>
                  <span className="player-pill team-pill" style={playerStyle(name)}>
                    {name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
