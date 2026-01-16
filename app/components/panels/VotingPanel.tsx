import { VOTE_WEIGHTS } from "../../lib/constants";
import type { VoteLevel, VoteSummaryEntry, WheelItem } from "../../lib/types";

type VotingPanelProps = {
  items: WheelItem[];
  hiddenLabels: boolean;
  votesByItem: Record<string, VoteLevel>;
  voteSummary: VoteSummaryEntry[];
  userName: string;
  roomVotes: Record<string, Record<string, VoteLevel>>;
  onUserNameChange: (value: string) => void;
  onSetVote: (itemId: string, level: VoteLevel) => void;
};

export default function VotingPanel({
  items,
  hiddenLabels,
  votesByItem,
  voteSummary,
  userName,
  roomVotes,
  onUserNameChange,
  onSetVote,
}: VotingPanelProps) {
  // Calculate vote counts per item
  const itemVoteCounts = items.map((item) => {
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
    const totalWeight = votes.gold * VOTE_WEIGHTS.gold + 
                       votes.silver * VOTE_WEIGHTS.silver + 
                       votes.bronze * VOTE_WEIGHTS.bronze;
    return { item, votes, totalWeight };
  });

  return (
    <div className="panel-block">
      <h3>Games & Votes</h3>
      <label className="field">
        Your name
        <input
          type="text"
          value={userName}
          onChange={(event) => onUserNameChange(event.target.value)}
          placeholder="Player name"
        />
      </label>
      <div className="games-votes-list">
        {itemVoteCounts.map(({ item, votes, totalWeight }) => (
          <div key={item.id} className="game-vote-item">
            <div className="game-vote-header">
              <span className="game-name">
                {hiddenLabels ? "Mystery item" : item.label}
              </span>
              <span className="vote-total">Weight: {totalWeight.toFixed(1)}</span>
            </div>
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
            <div className="vote-actions">
              {(["gold", "silver", "bronze"] as VoteLevel[]).map((level) => (
                <button
                  key={level}
                  className={`vote ${level} ${
                    votesByItem[item.id] === level ? "active" : ""
                  }`}
                  onClick={() => onSetVote(item.id, level)}
                >
                  {level} ({VOTE_WEIGHTS[level]})
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {voteSummary.length > 0 && (
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
