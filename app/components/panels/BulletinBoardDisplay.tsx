"use client";

import ReactMarkdown from "react-markdown";

type BulletinBoardDisplayProps = {
  content: string | null;
};

export default function BulletinBoardDisplay({
  content,
}: BulletinBoardDisplayProps) {
  if (!content || !content.trim()) {
    return null;
  }

  return (
    <div className="panel-block bulletin-display">
      <h3>Bulletin Board</h3>
      <div className="bulletin-content">
        <ReactMarkdown
          components={{
            // Style links to be visible
            a: ({ node, ...props }) => (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--accent)",
                  textDecoration: "underline",
                }}
              />
            ),
            // Style headers
            h1: ({ node, ...props }) => (
              <h1 {...props} style={{ fontSize: "1.5rem", marginTop: "16px", marginBottom: "8px" }} />
            ),
            h2: ({ node, ...props }) => (
              <h2 {...props} style={{ fontSize: "1.3rem", marginTop: "14px", marginBottom: "6px" }} />
            ),
            h3: ({ node, ...props }) => (
              <h3 {...props} style={{ fontSize: "1.1rem", marginTop: "12px", marginBottom: "4px" }} />
            ),
            // Style lists
            ul: ({ node, ...props }) => (
              <ul {...props} style={{ marginLeft: "20px", marginTop: "8px", marginBottom: "8px" }} />
            ),
            ol: ({ node, ...props }) => (
              <ol {...props} style={{ marginLeft: "20px", marginTop: "8px", marginBottom: "8px" }} />
            ),
            // Style code blocks
            code: ({ node, inline, ...props }) =>
              inline ? (
                <code
                  {...props}
                  style={{
                    background: "var(--panel-strong)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "0.9em",
                  }}
                />
              ) : (
                <code
                  {...props}
                  style={{
                    display: "block",
                    background: "var(--panel-strong)",
                    padding: "12px",
                    borderRadius: "6px",
                    overflowX: "auto",
                    marginTop: "8px",
                    marginBottom: "8px",
                  }}
                />
              ),
            // Style blockquotes
            blockquote: ({ node, ...props }) => (
              <blockquote
                {...props}
                style={{
                  borderLeft: "3px solid var(--accent)",
                  paddingLeft: "12px",
                  marginLeft: "0",
                  marginTop: "8px",
                  marginBottom: "8px",
                  fontStyle: "italic",
                  opacity: 0.9,
                }}
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

