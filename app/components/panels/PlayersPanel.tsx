type PlayersPanelProps = {
  players: string[];
  adminName: string | null;
};

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function playerStyle(name: string) {
  const hue = hashString(name) % 360;
  return {
    background: `hsla(${hue}, 70%, 60%, 0.18)`,
    borderColor: `hsla(${hue}, 70%, 60%, 0.5)`,
    color: `hsl(${hue}, 80%, 80%)`,
  };
}

export default function PlayersPanel({ players, adminName }: PlayersPanelProps) {
  // Sort players to put admin first
  const sortedPlayers = [...players].sort((a, b) => {
    if (!adminName) return 0;
    const aIsAdmin = a.trim().toLowerCase() === adminName.trim().toLowerCase();
    const bIsAdmin = b.trim().toLowerCase() === adminName.trim().toLowerCase();
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;
    return 0;
  });

  return (
    <div className="panel-block">
      <h3>Players</h3>
      {sortedPlayers.length ? (
        <ul className="players-list">
          {sortedPlayers.map((name) => (
            <li key={name} className="player-pill" style={playerStyle(name)}>
              {name}
              {adminName && name.trim().toLowerCase() === adminName.trim().toLowerCase() && (
                <span className="admin-crown">👑</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="subtle">No players yet.</p>
      )}
    </div>
  );
}
