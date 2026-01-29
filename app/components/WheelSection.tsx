import Image from "next/image";
import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { TeamState, WheelItem, WheelSegment } from "../lib/types";
import TeamsSection from "./TeamsSection";

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
  showLegend?: boolean;
  playerStats?: Record<string, { wins: number; losses: number }>;
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
  showLegend = true,
  playerStats,
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

      {presentationMode && !viewMode && showLegend && legendData.length > 0 && (
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
              <div className="result-header">
                {landedItem.imageUrl && (
                  <Image
                    src={landedItem.imageUrl}
                    alt={landedItem.label}
                    className="result-image"
                    width={160}
                    height={120}
                    unoptimized
                  />
                )}
                <h2>{landedItem.label}</h2>
              </div>
            </div>
          )}
        </div>
      )}

      {!viewMode && !presentationMode && !isSpinning && (adminUnlocked || teamState) && (
        <TeamsSection
          teamState={teamState}
          teamShuffle={teamShuffle}
          adminUnlocked={adminUnlocked}
          landedItemLabel={landedItem?.label}
          playerStats={playerStats}
          showControls
          onCreateTeams={onCreateTeams}
          onCreateFreeForAll={onCreateFreeForAll}
          onAwardTeamWin={onAwardTeamWin}
          onAwardTeamLoss={onAwardTeamLoss}
        />
      )}

      {statusMessage && <p className="warning">{statusMessage}</p>}
    </section>
  );
}
