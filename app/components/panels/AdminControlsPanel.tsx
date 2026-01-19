import type { NoRepeatMode } from "../../lib/types";

type AdminControlsPanelProps = {
  mysteryEnabled: boolean;
  noRepeatMode: NoRepeatMode;
  chatEnabled: boolean;
  onMysteryToggle: (value: boolean) => void;
  onNoRepeatModeChange: (value: NoRepeatMode) => void;
  onChatToggle: (value: boolean) => void;
  onResetSessionHistory: () => void;
  onResetVotes: () => void;
  onResetHistory: () => void;
  onResetItems: () => void;
  onResetResult: () => void;
  onResetAdmin: () => void;
};

export default function AdminControlsPanel({
  mysteryEnabled,
  noRepeatMode,
  chatEnabled,
  onMysteryToggle,
  onNoRepeatModeChange,
  onChatToggle,
  onResetSessionHistory,
  onResetVotes,
  onResetHistory,
  onResetItems,
  onResetResult,
  onResetAdmin,
}: AdminControlsPanelProps) {
  return (
    <div className="panel-block">
      <h3>Admin controls</h3>
      <div className="toggle-row" style={{ marginBottom: "16px" }}>
        <label>
          <input
            type="checkbox"
            checked={mysteryEnabled}
            onChange={(event) => onMysteryToggle(event.target.checked)}
          />
          Mystery mode
        </label>
        <label>
          <input
            type="checkbox"
            checked={chatEnabled}
            onChange={(event) => onChatToggle(event.target.checked)}
          />
          Chat enabled
        </label>
        <label>
          No-repeat mode
          <select
            value={noRepeatMode}
            onChange={(event) =>
              onNoRepeatModeChange(event.target.value as NoRepeatMode)
            }
          >
            <option value="off">Off</option>
            <option value="consecutive">No consecutive repeats</option>
            <option value="session">Once per session</option>
          </select>
        </label>
        {noRepeatMode === "session" && (
          <button className="ghost" onClick={onResetSessionHistory}>
            Reset session history
          </button>
        )}
      </div>
      <div className="admin-actions">
        <button className="ghost" onClick={onResetVotes}>
          Reset votes
        </button>
        <button className="ghost" onClick={onResetHistory}>
          Reset no-repeat history
        </button>
        <button className="ghost" onClick={onResetItems}>
          Reset items
        </button>
        <button className="ghost" onClick={onResetResult}>
          Reset spin result
        </button>
        <button className="ghost" onClick={onResetAdmin}>
          Reset admin claim
        </button>
      </div>
    </div>
  );
}
