import type { NoRepeatMode } from "../../lib/types";

type ModesPanelProps = {
  votingEnabled: boolean;
  mysteryEnabled: boolean;
  noRepeatMode: NoRepeatMode;
  presentationMode: boolean;
  controlsEnabled: boolean;
  onVotingToggle: (value: boolean) => void;
  onMysteryToggle: (value: boolean) => void;
  onNoRepeatModeChange: (value: NoRepeatMode) => void;
  onPresentationModeToggle: (value: boolean) => void;
  onResetSessionHistory: () => void;
};

export default function ModesPanel({
  votingEnabled,
  mysteryEnabled,
  noRepeatMode,
  presentationMode,
  controlsEnabled,
  onVotingToggle,
  onMysteryToggle,
  onNoRepeatModeChange,
  onPresentationModeToggle,
  onResetSessionHistory,
}: ModesPanelProps) {
  return (
    <div className="panel-block">
      <h3>Modes</h3>
      <div className="toggle-row">
        <label>
          <input
            type="checkbox"
            checked={votingEnabled}
            onChange={(event) => onVotingToggle(event.target.checked)}
            disabled={!controlsEnabled}
          />
          Voting mode
        </label>
        <label>
          <input
            type="checkbox"
            checked={mysteryEnabled}
            onChange={(event) => onMysteryToggle(event.target.checked)}
            disabled={!controlsEnabled}
          />
          Mystery mode
        </label>
        <label>
          <input
            type="checkbox"
            checked={presentationMode}
            onChange={(event) => onPresentationModeToggle(event.target.checked)}
            disabled={!controlsEnabled}
          />
          Presentation mode
        </label>
      </div>
      <div className="toggle-row">
        <label>
          No-repeat mode
          <select
            value={noRepeatMode}
            onChange={(event) =>
              onNoRepeatModeChange(event.target.value as NoRepeatMode)
            }
            disabled={!controlsEnabled}
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
    </div>
  );
}
