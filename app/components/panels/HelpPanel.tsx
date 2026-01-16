type HelpPanelProps = {
  onApplyQueryParams: (params: Record<string, string>) => void;
};

export default function HelpPanel({ onApplyQueryParams }: HelpPanelProps) {
  return (
    <div className="panel-block">
      <h3>Help &amp; config</h3>
      <ul className="help-list">
        <li>
          <strong>Room:</strong>{" "}
          <button
            className="pill pill-button"
            onClick={() => onApplyQueryParams({ room: "party" })}
          >
            ?room=party
          </button>{" "}
          keeps sessions in sync.
        </li>
        <li>
          <strong>View mode:</strong>{" "}
          <button
            className="pill pill-button"
            onClick={() => onApplyQueryParams({ view: "1" })}
          >
            ?view=1
          </button>{" "}
          shows a large wheel only.
        </li>
      </ul>
    </div>
  );
}
