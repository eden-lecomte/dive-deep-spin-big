type AdminAccessPanelProps = {
  userName: string;
  adminClaimed: boolean;
  adminPin: string;
  socketReady: boolean;
  onUserNameChange: (value: string) => void;
  onAdminPinChange: (value: string) => void;
  onClaimAdmin: () => void;
  onUnlockAdmin: () => void;
};

export default function AdminAccessPanel({
  userName,
  adminClaimed,
  adminPin,
  socketReady,
  onUserNameChange,
  onAdminPinChange,
  onClaimAdmin,
  onUnlockAdmin,
}: AdminAccessPanelProps) {
  return (
    <div className="panel-block">
      <h3>Admin access</h3>
      <p className="subtle">
        {adminClaimed
          ? "Admin is claimed for this room."
          : "No admin yet. First person can claim it."}
      </p>
      <label className="field">
        Your name
        <input
          type="text"
          value={userName}
          onChange={(event) => onUserNameChange(event.target.value)}
          placeholder="Player name"
        />
      </label>
      <label className="field">
        4-digit admin code
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={adminPin}
          onChange={(event) =>
            onAdminPinChange(event.target.value.replace(/\D/g, ""))
          }
          placeholder="0000"
        />
      </label>
      {!adminClaimed ? (
        <button className="primary" onClick={onClaimAdmin} disabled={!socketReady}>
          Claim admin
        </button>
      ) : (
        <button className="primary" onClick={onUnlockAdmin} disabled={!socketReady}>
          Unlock admin
        </button>
      )}
    </div>
  );
}
