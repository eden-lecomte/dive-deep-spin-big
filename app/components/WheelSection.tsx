import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import type { TeamState, WheelItem, WheelSegment } from "../lib/types";

type WheelSectionProps = {
  viewMode: boolean;
  showSpin: boolean;
  rotation: number;
  spinDuration: number;
  isSpinning: boolean;
  itemsCount: number;
  segments: WheelSegment[];
  gradient: string;
  hiddenLabels: boolean;
  pendingResultId: string | null;
  landedItem: WheelItem | null;
  teamState: TeamState | null;
  teamShuffle: boolean;
  statusMessage: string | null;
  adminUnlocked: boolean;
  presentationMode?: boolean;
  votingEnabled?: boolean;
  voteTotals?: Record<string, number>;
  onSpin: () => void;
  onResetRotation: () => void;
  onCreateTeams: () => void;
  onCreateFreeForAll: () => void;
  onAwardTeamWin: (team: string[]) => void;
  onAwardTeamLoss: (team: string[]) => void;
};

export default function WheelSection({
  viewMode,
  showSpin,
  rotation,
  spinDuration,
  isSpinning,
  itemsCount,
  segments,
  gradient,
  hiddenLabels,
  pendingResultId,
  landedItem,
  teamState,
  teamShuffle,
  statusMessage,
  adminUnlocked,
  presentationMode = false,
  votingEnabled = false,
  voteTotals = {},
  onSpin,
  onResetRotation,
  onCreateTeams,
  onCreateFreeForAll,
  onAwardTeamWin,
  onAwardTeamLoss,
}: WheelSectionProps) {
  const shellStyle: CSSProperties = {
    ["--wheel-rotation" as string]: `${rotation}deg`,
    ["--spin-duration" as string]: `${spinDuration}ms`,
  };

  // Track recently awarded victories to disable buttons temporarily
  const [recentlyAwarded, setRecentlyAwarded] = useState<{
    team: "A" | "B" | string | null;
    type: "win" | "loss" | null;
  }>({ team: null, type: null });

  useEffect(() => {
    if (recentlyAwarded.team && recentlyAwarded.type) {
      const timer = setTimeout(() => {
        setRecentlyAwarded({ team: null, type: null });
      }, 3000); // 3 seconds
      return () => clearTimeout(timer);
    }
  }, [recentlyAwarded]);

  const handleTeamWin = (team: "A" | "B" | string, teamNames: string[]) => {
    setRecentlyAwarded({ team, type: "win" });
    onAwardTeamWin(teamNames);
  };

  const handleTeamLoss = (team: "A" | "B" | string, teamNames: string[]) => {
    setRecentlyAwarded({ team, type: "loss" });
    onAwardTeamLoss(teamNames);
  };

  const legendData = useMemo(() => {
    if (!presentationMode || !segments.length) return [];
    
    const totalWeight = segments.reduce((sum, seg) => {
      const sliceSize = seg.end - seg.start;
      return sum + sliceSize;
    }, 0);

    return segments
      .map((segment) => {
        const sliceSize = segment.end - segment.start;
        const percentage = (sliceSize / totalWeight) * 100;
        const votes = voteTotals[segment.id] || 0;
        return {
          ...segment,
          percentage,
          votes,
        };
      })
      .sort((a, b) => {
        // Sort by weight descending (percentage)
        return b.percentage - a.percentage;
      });
  }, [presentationMode, segments, voteTotals]);

  return (
    <section className="wheel-card">
      <div
        className={`wheel-shell ${isSpinning ? "spinning" : ""}`}
        style={shellStyle}
      >
        <div className="pointer" />
        <div
          className={`wheel ${isSpinning ? "spinning" : ""}`}
          style={{
            ["--wheel-gradient" as string]: gradient,
            transform: `rotate(${rotation}deg)`,
          }}
        ></div>
        <div className="wheel-labels">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className="wheel-label"
              style={{ ["--angle" as string]: `${segment.mid}deg` }}
            >
              {hiddenLabels ? "?" : segment.label}
            </div>
          ))}
        </div>
        <div className="center-cap" />
      </div>

      {presentationMode && legendData.length > 0 && (
        <div className="wheel-legend">
          <h3 className="legend-title">Odds</h3>
          <ul className="legend-list">
            {legendData.map((item) => (
              <li key={item.id} className="legend-item">
                <div
                  className="legend-color"
                  style={{ backgroundColor: item.color }}
                />
                <span className="legend-label">{item.label}</span>
                <span className="legend-value">
                  {votingEnabled && item.votes > 0
                    ? `${item.votes} vote${item.votes !== 1 ? "s" : ""}`
                    : `${item.percentage.toFixed(1)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showSpin && (
        <div className="wheel-actions">
          <button
            className="primary"
            onClick={onSpin}
            disabled={isSpinning || !itemsCount}
          >
            {isSpinning ? "Spinning..." : "Spin the Wheel"}
          </button>
          {!viewMode && (
            <button
              className="ghost"
              onClick={onResetRotation}
              disabled={isSpinning}
            >
              Reset rotation
            </button>
          )}
        </div>
      )}

      {!viewMode && (
        <div className="result">
          <p className="eyebrow">Result</p>
          {pendingResultId && isSpinning && <p className="result-text">Spinning...</p>}
          {landedItem && !isSpinning && (
            <div className="result-card">
              <div>
                <h2>{landedItem.label}</h2>
                {landedItem.imageUrl && (
                  <Image
                    src={landedItem.imageUrl}
                    alt={landedItem.label}
                    className="result-image"
                    width={280}
                    height={200}
                    unoptimized
                  />
                )}
              </div>
              <div className="result-meta">
                <p>Weight: {landedItem.weight}</p>
                {landedItem.soundUrl && <p>Sound: Ready</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {!viewMode && landedItem && !isSpinning && (
        <div className="team-area">
          <div className="team-header">
            <p className="eyebrow">Teams</p>
            {adminUnlocked && !teamState && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="primary" onClick={onCreateTeams}>
                  Create teams for {landedItem.label}
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
                  {adminUnlocked && (
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
                    <li key={`a-${name}-${index}`}>{name}</li>
                  ))}
                </ul>
              </div>
              <div className={`team-card ${teamShuffle ? "shuffle" : ""}`}>
                <div className="team-card-header">
                  <h3>Team B</h3>
                  {adminUnlocked && (
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
                    <li key={`b-${name}-${index}`}>{name}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {statusMessage && <p className="warning">{statusMessage}</p>}
    </section>
  );
}
