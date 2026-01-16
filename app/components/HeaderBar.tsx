type HeaderBarProps = {
  room: string;
  viewMode: boolean;
  socketReady: boolean;
};

export default function HeaderBar({
  room,
  viewMode,
  socketReady,
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
        <div className="status">
          <span className={`status-dot ${socketReady ? "ok" : "warn"}`} />
          {socketReady ? "Connected" : "Offline"}
        </div>
      )}
    </header>
  );
}
