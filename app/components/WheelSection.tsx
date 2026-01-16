import Image from "next/image";
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
  onSpin: () => void;
  onResetRotation: () => void;
  onCreateTeams: () => void;
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
  onSpin,
  onResetRotation,
  onCreateTeams,
  onAwardTeamWin,
  onAwardTeamLoss,
}: WheelSectionProps) {
  const shellStyle: CSSProperties = {
    ["--wheel-rotation" as string]: `${rotation}deg`,
    ["--spin-duration" as string]: `${spinDuration}ms`,
  };

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
            backgroundImage: gradient,
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
            <button className="primary" onClick={onCreateTeams}>
              Create teams for {landedItem.label}
            </button>
          </div>
          {teamState && (
            <div className="team-grid">
              <div className={`team-card ${teamShuffle ? "shuffle" : ""}`}>
                <div className="team-card-header">
                  <h3>Team A</h3>
                  {adminUnlocked && (
                    <div className="team-actions">
                      <button
                        className="ghost win-button"
                        onClick={() => onAwardTeamWin(teamState.teamA)}
                        title="Award win to Team A"
                      >
                        🏆
                      </button>
                      <button
                        className="ghost loss-button"
                        onClick={() => onAwardTeamLoss(teamState.teamA)}
                        title="Award loss to Team A"
                      >
                        💀
                      </button>
                    </div>
                  )}
                </div>
                <ul>
                  {teamState.teamA.map((name) => (
                    <li key={`a-${name}`}>{name}</li>
                  ))}
                </ul>
              </div>
              <div className={`team-card ${teamShuffle ? "shuffle" : ""}`}>
                <div className="team-card-header">
                  <h3>Team B</h3>
                  {adminUnlocked && (
                    <div className="team-actions">
                      <button
                        className="ghost win-button"
                        onClick={() => onAwardTeamWin(teamState.teamB)}
                        title="Award win to Team B"
                      >
                        🏆
                      </button>
                      <button
                        className="ghost loss-button"
                        onClick={() => onAwardTeamLoss(teamState.teamB)}
                        title="Award loss to Team B"
                      >
                        💀
                      </button>
                    </div>
                  )}
                </div>
                <ul>
                  {teamState.teamB.map((name) => (
                    <li key={`b-${name}`}>{name}</li>
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
