type PlayersPanelProps = {
  players: string[];
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

export default function PlayersPanel({ players }: PlayersPanelProps) {
  return (
    <div className="panel-block">
      <h3>Players</h3>
      {players.length ? (
        <ul className="players-list">
          {players.map((name) => (
            <li key={name} className="player-pill" style={playerStyle(name)}>
              {name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="subtle">No players yet.</p>
      )}
    </div>
  );
}
