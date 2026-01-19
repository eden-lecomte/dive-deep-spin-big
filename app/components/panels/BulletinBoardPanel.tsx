"use client";

import { useState, useEffect } from "react";

type BulletinBoardPanelProps = {
  content: string | null;
  adminUnlocked: boolean;
  socketReady: boolean;
  onUpdate: (content: string | null) => void;
};

export default function BulletinBoardPanel({
  content,
  adminUnlocked,
  socketReady,
  onUpdate,
}: BulletinBoardPanelProps) {
  const [editorContent, setEditorContent] = useState(content || "");
  const [isSaving, setIsSaving] = useState(false);

  // Update editor content when server content changes (but not while user is editing)
  useEffect(() => {
    if (!isSaving) {
      setEditorContent(content || "");
    }
  }, [content, isSaving]);

  const handleSave = () => {
    if (!socketReady || !adminUnlocked) return;
    setIsSaving(true);
    const trimmedContent = editorContent.trim() || null;
    onUpdate(trimmedContent);
    // Reset saving state after a short delay
    setTimeout(() => setIsSaving(false), 500);
  };

  const handleClear = () => {
    if (!socketReady || !adminUnlocked) return;
    if (confirm("Are you sure you want to clear the bulletin board?")) {
      setEditorContent("");
      onUpdate(null);
    }
  };

  if (!adminUnlocked) {
    return null;
  }

  return (
    <div className="panel-block">
      <h3>Bulletin Board</h3>
      <p className="subtle" style={{ marginBottom: "12px", fontSize: "0.9rem" }}>
        Markdown supported: **bold**, *italic*, [links](url), # headers, - lists
      </p>
      <textarea
        className="bulletin-editor"
        value={editorContent}
        onChange={(e) => setEditorContent(e.target.value)}
        placeholder="Enter bulletin board content (Markdown supported)..."
        rows={12}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: "var(--panel-strong)",
          color: "var(--text)",
          fontFamily: "inherit",
          fontSize: "0.95rem",
          lineHeight: "1.5",
          resize: "vertical",
          minHeight: "200px",
        }}
      />
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "12px",
        }}
      >
        <button
          className="primary"
          onClick={handleSave}
          disabled={!socketReady || isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          className="ghost"
          onClick={handleClear}
          disabled={!socketReady || isSaving}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

