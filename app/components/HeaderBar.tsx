type HeaderBarProps = {
  room: string;
  viewMode: boolean;
  socketReady: boolean;
  votingEnabled: boolean;
  adminActive: boolean;
  adminPopoverOpen: boolean;
  adminPopoverContent: React.ReactNode | null;
  onAdminClick: () => void;
  onLeaveRoom: () => void;
};

export default function HeaderBar({
  room,
  viewMode,
  socketReady,
  votingEnabled,
  adminActive,
  adminPopoverOpen,
  adminPopoverContent,
  onAdminClick,
  onLeaveRoom,
}: HeaderBarProps) {
  return (
    <header className="header">
      <div>
        <p className="eyebrow">Spin Room</p>
        <h1>Dive Deep Spin Big</h1>
        <p className="subtle">
          Room: <span className="pill">{room}</span>
        </p>
      </div>
      {!viewMode && (
        <div className="status-group">
          <button className="ghost" onClick={onLeaveRoom}>
            Leave room
          </button>
          <div className="admin-wrapper">
            <button className="ghost admin-indicator" onClick={onAdminClick}>
              <span className={`status-dot ${adminActive ? "ok" : "warn"}`} />
              {adminActive ? "Admin active" : "Admin login"}
            </button>
            {adminPopoverOpen && adminPopoverContent}
          </div>
          <div className="status">
            <span className={`status-dot ${votingEnabled ? "ok" : "warn"}`} />
            {votingEnabled ? "Voting enabled" : "Voting disabled"}
          </div>
          <div className="status">
            <span className={`status-dot ${socketReady ? "ok" : "warn"}`} />
            {socketReady ? "Connected" : "Offline"}
          </div>
        </div>
      )}
    </header>
  );
}
