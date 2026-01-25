"use client";

import { useMemo } from "react";
import { VOTE_WEIGHTS } from "../../lib/constants";
import type { NoRepeatMode, VoteLevel, VoteSummaryEntry, WheelItem } from "../../lib/types";

type GamesListPanelProps = {
  items: WheelItem[];
  hiddenLabels: boolean;
  roomVotes: Record<string, Record<string, VoteLevel>>;
  votingEnabled?: boolean;
  votesByItem?: Record<string, VoteLevel>;
  voteSummary?: VoteSummaryEntry[];
  noRepeatMode?: NoRepeatMode;
  landedItemId?: string | null;
  usedItemIds?: string[];
  onSetVote?: (itemId: string, level: VoteLevel) => void;
  soundMuted?: boolean;
};

export default function GamesListPanel({
  items,
  hiddenLabels,
  roomVotes,
  votingEnabled = false,
  votesByItem = {},
  voteSummary = [],
  noRepeatMode = "off",
  landedItemId = null,
  usedItemIds = [],
  onSetVote,
  soundMuted = false,
}: GamesListPanelProps) {
  const playItemSound = (soundUrl?: string) => {
    if (!soundUrl || soundMuted) return;
    const audio = new Audio(soundUrl);
    audio.volume = 0.5;
    audio.play().catch(() => null);
  };
  // Calculate total weight for each item (base weight + vote weights)
  // This matches the calculation in HomePage.tsx for weightedItems
  const itemsWithWeights = useMemo(() => {
    // Calculate vote totals (sum of VOTE_WEIGHTS for each vote)
    const voteTotals: Record<string, number> = {};
    Object.values(roomVotes).forEach((playerVotes) => {
      Object.entries(playerVotes).forEach(([itemId, level]) => {
        voteTotals[itemId] = (voteTotals[itemId] || 0) + VOTE_WEIGHTS[level];
      });
    });
    
    // Sort items alphabetically by label
    const sortedItems = [...items].sort((a, b) => 
      a.label.localeCompare(b.label)
    );
    
    return sortedItems.map((item) => {
      // Count votes for display
      const votes: { gold: number; silver: number; bronze: number } = {
        gold: 0,
        silver: 0,
        bronze: 0,
      };
      
      Object.values(roomVotes).forEach((playerVotes) => {
        const level = playerVotes[item.id];
        if (level) {
          votes[level]++;
        }
      });
      
      // Total weight = base weight + vote totals (matches HomePage.tsx weightedItems calculation)
      const totalWeight = Math.max(0.1, (item.weight || 1) + (voteTotals[item.id] || 0));
      
      return { item, votes, totalWeight };
    });
  }, [items, roomVotes]);

  // Calculate total of all weights for percentage calculation
  const totalOfAllWeights = useMemo(() => {
    return itemsWithWeights.reduce((sum, { totalWeight }) => sum + totalWeight, 0);
  }, [itemsWithWeights]);

  // Determine which items are ineligible for voting based on no-repeat mode
  const ineligibleItemIds = useMemo(() => {
    const excluded = new Set<string>();
    if (noRepeatMode === "consecutive" && landedItemId) {
      excluded.add(landedItemId);
    }
    if (noRepeatMode === "session") {
      usedItemIds.forEach((id) => excluded.add(id));
    }
    return excluded;
  }, [noRepeatMode, landedItemId, usedItemIds]);

  return (
    <div className="panel-block">
      <h3>{votingEnabled ? "Games & Votes" : "Games"}</h3>
      
      <div className="games-votes-list">
        {itemsWithWeights.map(({ item, votes, totalWeight }) => {
          const percentage = totalOfAllWeights > 0 
            ? (totalWeight / totalOfAllWeights) * 100 
            : 0;
          const isIneligible = ineligibleItemIds.has(item.id);
          
          return (
            <div 
              key={item.id} 
              className={`game-vote-item ${isIneligible ? 'game-vote-item-disabled' : ''}`}
            >
              <div className="game-vote-header">
                <span className={`game-name ${isIneligible ? 'game-name-disabled' : ''}`}>
                  {item.imageUrl && (
                    <img
                      className="game-inline-image"
                      src={item.imageUrl}
                      alt=""
                      onClick={(event) => {
                        event.stopPropagation();
                        playItemSound(item.soundUrl);
                      }}
                      title={item.soundUrl ? "Play sound" : undefined}
                    />
                  )}
                  {hiddenLabels ? "Mystery item" : item.label}
                  {isIneligible && (
                    <span className="disabled-badge" title="Already spun - not available">
                      ✓
                    </span>
                  )}
                </span>
                <div className="game-vote-header-right">
                  {votingEnabled && (
                    <div className="vote-counts">
                      {votes.gold > 0 && (
                        <span className="vote-badge gold">
                          🥇 {votes.gold}
                        </span>
                      )}
                      {votes.silver > 0 && (
                        <span className="vote-badge silver">
                          🥈 {votes.silver}
                        </span>
                      )}
                      {votes.bronze > 0 && (
                        <span className="vote-badge bronze">
                          🥉 {votes.bronze}
                        </span>
                      )}
                      {votes.gold === 0 && votes.silver === 0 && votes.bronze === 0 && (
                        <span className="vote-badge none">No votes</span>
                      )}
                    </div>
                  )}
                  {votingEnabled && onSetVote && (
                    <div className="vote-actions-inline">
                      {(["gold", "silver", "bronze"] as VoteLevel[]).map((level) => {
                        const isIneligible = ineligibleItemIds.has(item.id);
                        return (
                          <button
                            key={level}
                            className={`vote-inline ${level} ${
                              votesByItem[item.id] === level ? "active" : ""
                            }`}
                            onClick={() => !isIneligible && onSetVote(item.id, level)}
                            disabled={isIneligible}
                            title={
                              isIneligible
                                ? "This item is ineligible due to no-repeat mode"
                                : `${level} (${VOTE_WEIGHTS[level]})`
                            }
                          >
                            {level === "gold" ? "🥇" : level === "silver" ? "🥈" : "🥉"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="weight-bar-container">
                <div 
                  className={`weight-bar ${isIneligible ? 'weight-bar-disabled' : ''}`}
                  style={{ width: `${percentage}%` }}
                  title={
                    isIneligible 
                      ? "Already spun - not available for selection"
                      : `Weight: ${totalWeight.toFixed(2)} (${percentage.toFixed(1)}%)`
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
      
      {votingEnabled && voteSummary.length > 0 && (
        <div className="vote-summary">
          <p className="eyebrow">Your votes</p>
          <ul>
            {voteSummary.map((entry) => (
              <li key={entry.item.id}>
                {entry.item.label}: {entry.level} ({VOTE_WEIGHTS[entry.level]})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
