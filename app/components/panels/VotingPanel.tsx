import { VOTE_WEIGHTS } from "../../lib/constants";
import type { VoteLevel, VoteSummaryEntry, WheelItem } from "../../lib/types";

type VotingPanelProps = {
  items: WheelItem[];
  hiddenLabels: boolean;
  votesByItem: Record<string, VoteLevel>;
  voteSummary: VoteSummaryEntry[];
  userName: string;
  onUserNameChange: (value: string) => void;
  onSetVote: (itemId: string, level: VoteLevel) => void;
};

export default function VotingPanel({
  items,
  hiddenLabels,
  votesByItem,
  voteSummary,
  userName,
  onUserNameChange,
  onSetVote,
}: VotingPanelProps) {
  return (
    <div className="panel-block">
      <h3>Voting</h3>
      <label className="field">
        Your name
        <input
          type="text"
          value={userName}
          onChange={(event) => onUserNameChange(event.target.value)}
          placeholder="Player name"
        />
      </label>
      <div className="vote-grid">
        {items.map((item) => (
          <div key={item.id} className="vote-card">
            <span>{hiddenLabels ? "Mystery item" : item.label}</span>
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
                {userName || "Anonymous"} → {entry.item.label}: {entry.level} (
                {VOTE_WEIGHTS[entry.level]})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
