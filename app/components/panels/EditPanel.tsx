import { useState, useEffect } from "react";
import { useLocalStorageState } from "../../hooks/useStoredState";
import type { DraftItem, WheelItem } from "../../lib/types";

type EditPanelProps = {
  editLocked: boolean;
  canEdit: boolean;
  items: WheelItem[];
  draftItem: DraftItem;
  onUpdateItem: (id: string, patch: Partial<WheelItem>) => void;
  onRemoveItem: (id: string) => void;
  onDraftChange: (draft: DraftItem) => void;
  onDraftSubmit: () => void;
  onSaveAsDefault?: () => Promise<boolean> | boolean;
};

export default function EditPanel({
  editLocked,
  canEdit,
  items,
  draftItem,
  onUpdateItem,
  onRemoveItem,
  onDraftChange,
  onDraftSubmit,
  onSaveAsDefault,
}: EditPanelProps) {
  const [pendingSave, setPendingSave] = useState(false);
  const [isCollapsed, setIsCollapsed] = useLocalStorageState<boolean>(
    "wheel:gamesListCollapsed",
    false
  );

  useEffect(() => {
    if (pendingSave) {
      const timer = setTimeout(() => {
        setPendingSave(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingSave]);
  return (
    <div className="panel-block">
      <div className="panel-header">
        <h3 style={{ margin: 0, flex: 1 }}>Games list</h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {editLocked && (
            <span className="warning-pill">Locked (admin required)</span>
          )}
          <button
            className="ghost"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ padding: "4px 8px", minWidth: "auto" }}
            title={isCollapsed ? "Expand games list" : "Collapse games list"}
          >
            {isCollapsed ? "▶" : "▼"}
          </button>
        </div>
      </div>
      {!isCollapsed && canEdit ? (
        <div className="edit-area">
          {onSaveAsDefault && (
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "flex-end" }}>
              <button
                className={`ghost ${pendingSave ? "pending-confirm" : ""}`}
                onClick={async () => {
                  if (pendingSave) {
                    try {
                      const result = await onSaveAsDefault();
                      setPendingSave(false);
                      return result;
                    } catch (error) {
                      setPendingSave(false);
                      return false;
                    }
                  } else {
                    setPendingSave(true);
                  }
                }}
                title={pendingSave ? "Click again to confirm" : "Save current items as default for new rooms"}
              >
                {pendingSave ? "Confirm Save" : "Save as default"}
              </button>
            </div>
          )}
          <div className="edit-list">
            {items.map((item) => (
              <div key={item.id} className="edit-row">
                <input
                  type="text"
                  value={item.label}
                  onChange={(event) =>
                    onUpdateItem(item.id, { label: event.target.value })
                  }
                />
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={item.weight}
                  onChange={(event) =>
                    onUpdateItem(item.id, {
                      weight: Number(event.target.value) || 1,
                    })
                  }
                />
                <input
                  type="text"
                  value={item.imageUrl || ""}
                  onChange={(event) =>
                    onUpdateItem(item.id, {
                      imageUrl: event.target.value || undefined,
                    })
                  }
                  placeholder="Image URL"
                />
                <input
                  type="text"
                  value={item.soundUrl || ""}
                  onChange={(event) =>
                    onUpdateItem(item.id, {
                      soundUrl: event.target.value || undefined,
                    })
                  }
                  placeholder="Sound URL"
                />
                <button className="ghost" onClick={() => onRemoveItem(item.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="edit-row add-row">
            <input
              type="text"
              value={draftItem.label}
              onChange={(event) =>
                onDraftChange({ ...draftItem, label: event.target.value })
              }
              placeholder="New item label"
            />
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={draftItem.weight}
              onChange={(event) =>
                onDraftChange({
                  ...draftItem,
                  weight: Number(event.target.value),
                })
              }
            />
            <input
              type="text"
              value={draftItem.imageUrl}
              onChange={(event) =>
                onDraftChange({ ...draftItem, imageUrl: event.target.value })
              }
              placeholder="Image URL"
            />
            <input
              type="text"
              value={draftItem.soundUrl}
              onChange={(event) =>
                onDraftChange({ ...draftItem, soundUrl: event.target.value })
              }
              placeholder="Sound URL"
            />
            <button className="primary" onClick={onDraftSubmit}>
              Add item
            </button>
          </div>
        </div>
      ) : !isCollapsed ? (
        <p className="subtle">Use the admin unlock code to edit this room.</p>
      ) : null}
    </div>
  );
}
