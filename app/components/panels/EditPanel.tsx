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
  onSaveAsDefault?: () => void;
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
  return (
    <div className="panel-block">
      <div className="panel-header">
        <h3>Games list</h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {onSaveAsDefault && (
            <button className="ghost" onClick={onSaveAsDefault} title="Save current items as default for new rooms">
              Save as default
            </button>
          )}
          {editLocked && (
            <span className="warning-pill">Locked (admin required)</span>
          )}
        </div>
      </div>
      {canEdit ? (
        <div className="edit-area">
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
      ) : (
        <p className="subtle">Use the admin unlock code to edit this room.</p>
      )}
    </div>
  );
}
