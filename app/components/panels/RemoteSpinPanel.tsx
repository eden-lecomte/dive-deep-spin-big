type RemoteSpinPanelProps = {
  room: string;
};

export default function RemoteSpinPanel({ room }: RemoteSpinPanelProps) {
  return (
    <div className="panel-block">
      <h3>Remote spin</h3>
      <p className="subtle">
        Trigger from any device:
        <span className="pill">?room={room}&amp;spin=1</span>
      </p>
    </div>
  );
}
