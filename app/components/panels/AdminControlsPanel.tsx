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
  onTimerStart: (duration: number) => void;
  onTimerStop: () => void;
  timer: { endTime: number; duration: number } | null;
  socketReady: boolean;
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
  onTimerStart,
  onTimerStop,
  timer,
  socketReady,
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
      <div className="timer-controls" style={{ marginBottom: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
          Voting Timer
        </label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            className="ghost"
            onClick={() => onTimerStart(15)}
            disabled={!socketReady || (timer !== null && timer.endTime > Date.now())}
            title="Start 15 minute timer"
          >
            15 min
          </button>
          <button
            className="ghost"
            onClick={() => onTimerStart(10)}
            disabled={!socketReady || (timer !== null && timer.endTime > Date.now())}
            title="Start 10 minute timer"
          >
            10 min
          </button>
          <button
            className="ghost"
            onClick={() => onTimerStart(5)}
            disabled={!socketReady || (timer !== null && timer.endTime > Date.now())}
            title="Start 5 minute timer"
          >
            5 min
          </button>
          {timer !== null && timer.endTime > Date.now() && (
            <button
              className="ghost danger"
              onClick={onTimerStop}
              disabled={!socketReady}
              title="Stop timer early"
            >
              Stop Timer
            </button>
          )}
        </div>
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
