import { useState, useEffect, useRef } from "react";
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
  onExportItems?: () => Promise<boolean> | boolean;
  onImportItems?: (items: WheelItem[]) => Promise<boolean> | boolean;
  onImportError?: (message: string) => void;
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
  onExportItems,
  onImportItems,
  onImportError,
}: EditPanelProps) {
  const [pendingSave, setPendingSave] = useState(false);
  const [exportStatus, setExportStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [invalidImages, setInvalidImages] = useState<Record<string, boolean>>({});
  const [invalidDraftImage, setInvalidDraftImage] = useState(false);
  const [imageOptions, setImageOptions] = useState<string[]>([]);
  const [soundOptions, setSoundOptions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useLocalStorageState<boolean>(
    "wheel:gamesListCollapsed",
    false
  );

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch("/api/assets/images").then((res) => res.json()),
      fetch("/api/assets/sfx").then((res) => res.json()),
    ])
      .then(([images, sfx]) => {
        if (!isMounted) return;
        setImageOptions(Array.isArray(images?.files) ? images.files : []);
        setSoundOptions(Array.isArray(sfx?.files) ? sfx.files : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setImageOptions([]);
        setSoundOptions([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const playSoundPreview = (url?: string) => {
    if (!url) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    const audio = new Audio(url);
    audio.volume = 0.5;
    previewAudioRef.current = audio;
    audio.play().catch(() => null);
  };

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !onImportItems) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || ""));
        if (!Array.isArray(payload)) {
          onImportError?.("Invalid file: expected a JSON array.");
          setImportStatus("error");
          setTimeout(() => setImportStatus("idle"), 2000);
          return;
        }
        const result = onImportItems(payload as WheelItem[]);
        Promise.resolve(result)
          .then((success) => {
            setImportStatus(success ? "success" : "error");
            setTimeout(() => setImportStatus("idle"), 2000);
          })
          .catch(() => {
            setImportStatus("error");
            setTimeout(() => setImportStatus("idle"), 2000);
          });
      } catch {
        onImportError?.("Invalid JSON file.");
        setImportStatus("error");
        setTimeout(() => setImportStatus("idle"), 2000);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

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
            <div
              style={{
                marginBottom: "16px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {onExportItems && (
                <button
                  className={`ghost ${
                    exportStatus === "success"
                      ? "pending-confirm"
                      : exportStatus === "error"
                      ? "danger"
                      : ""
                  }`}
                  onClick={() => {
                    const result = onExportItems();
                    Promise.resolve(result)
                      .then((success) => {
                        setExportStatus(success ? "success" : "error");
                        setTimeout(() => setExportStatus("idle"), 2000);
                      })
                      .catch(() => {
                        setExportStatus("error");
                        setTimeout(() => setExportStatus("idle"), 2000);
                      });
                  }}
                >
                  {exportStatus === "success"
                    ? "Exported"
                    : exportStatus === "error"
                    ? "Export failed"
                    : "Export items"}
                </button>
              )}
              {onImportItems && (
                <>
                  <button
                    className={`ghost ${
                      importStatus === "success"
                        ? "pending-confirm"
                        : importStatus === "error"
                        ? "danger"
                        : ""
                    }`}
                    onClick={handleImportClick}
                  >
                    {importStatus === "success"
                      ? "Imported"
                      : importStatus === "error"
                      ? "Import failed"
                      : "Import items"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                </>
              )}
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
                  className="weight-input"
                  onChange={(event) =>
                    onUpdateItem(item.id, {
                      weight: Number(event.target.value) || 1,
                    })
                  }
                />
                <div className="image-input-with-preview">
                  {imageOptions.length > 0 && (
                    <select
                      value={
                        item.imageUrl?.startsWith("/assets/images/")
                          ? item.imageUrl
                          : ""
                      }
                      onChange={(event) => {
                        setInvalidImages((prev) => ({ ...prev, [item.id]: false }));
                        onUpdateItem(item.id, {
                          imageUrl: event.target.value || undefined,
                        });
                      }}
                    >
                      <option value="">Select image…</option>
                      {imageOptions.map((file) => (
                        <option key={file} value={`/assets/images/${file}`}>
                          {file}
                        </option>
                      ))}
                    </select>
                  )}
                  {item.imageUrl && !invalidImages[item.id] && (
                    <img
                      className="edit-image-preview"
                      src={item.imageUrl}
                      alt=""
                      onError={() =>
                        setInvalidImages((prev) => ({ ...prev, [item.id]: true }))
                      }
                    />
                  )}
                </div>
                <div className="asset-input-stack">
                  {soundOptions.length > 0 && (
                    <div className="sound-select-row">
                      <select
                        value={
                          item.soundUrl?.startsWith("/assets/sfx/")
                            ? item.soundUrl
                            : ""
                        }
                        onChange={(event) =>
                          onUpdateItem(item.id, {
                            soundUrl: event.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Select sound…</option>
                        {soundOptions.map((file) => (
                          <option key={file} value={`/assets/sfx/${file}`}>
                            {file}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => playSoundPreview(item.soundUrl)}
                        disabled={!item.soundUrl}
                        title="Preview sound"
                      >
                        ▶
                      </button>
                    </div>
                  )}
                </div>
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
              className="weight-input"
              onChange={(event) =>
                onDraftChange({
                  ...draftItem,
                  weight: Number(event.target.value),
                })
              }
            />
            <div className="image-input-with-preview">
              {imageOptions.length > 0 && (
                <select
                  value={
                    draftItem.imageUrl.startsWith("/assets/images/")
                      ? draftItem.imageUrl
                      : ""
                  }
                  onChange={(event) => {
                    setInvalidDraftImage(false);
                    onDraftChange({
                      ...draftItem,
                      imageUrl: event.target.value,
                    });
                  }}
                >
                  <option value="">Select image…</option>
                  {imageOptions.map((file) => (
                    <option key={file} value={`/assets/images/${file}`}>
                      {file}
                    </option>
                  ))}
                </select>
              )}
              {draftItem.imageUrl && !invalidDraftImage && (
                <img
                  className="edit-image-preview"
                  src={draftItem.imageUrl}
                  alt=""
                  onError={() => setInvalidDraftImage(true)}
                />
              )}
            </div>
            <div className="asset-input-stack">
              {soundOptions.length > 0 && (
                <div className="sound-select-row">
                  <select
                    value={
                      draftItem.soundUrl.startsWith("/assets/sfx/")
                        ? draftItem.soundUrl
                        : ""
                    }
                    onChange={(event) =>
                      onDraftChange({ ...draftItem, soundUrl: event.target.value })
                    }
                  >
                    <option value="">Select sound…</option>
                    {soundOptions.map((file) => (
                      <option key={file} value={`/assets/sfx/${file}`}>
                        {file}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => playSoundPreview(draftItem.soundUrl)}
                    disabled={!draftItem.soundUrl}
                    title="Preview sound"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>
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
