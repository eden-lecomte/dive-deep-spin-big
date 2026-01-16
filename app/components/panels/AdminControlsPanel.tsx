type AdminControlsPanelProps = {
  onResetVotes: () => void;
  onResetHistory: () => void;
  onResetItems: () => void;
  onResetResult: () => void;
  onResetAdmin: () => void;
};

export default function AdminControlsPanel({
  onResetVotes,
  onResetHistory,
  onResetItems,
  onResetResult,
  onResetAdmin,
}: AdminControlsPanelProps) {
  return (
    <div className="panel-block">
      <h3>Admin controls</h3>
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
