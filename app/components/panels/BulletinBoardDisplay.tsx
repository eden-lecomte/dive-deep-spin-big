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
            a: (props) => (
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
            h1: (props) => (
              <h1 {...props} style={{ fontSize: "1.5rem", marginTop: "16px", marginBottom: "8px" }} />
            ),
            h2: (props) => (
              <h2 {...props} style={{ fontSize: "1.3rem", marginTop: "14px", marginBottom: "6px" }} />
            ),
            h3: (props) => (
              <h3 {...props} style={{ fontSize: "1.1rem", marginTop: "12px", marginBottom: "4px" }} />
            ),
            // Style lists
            ul: (props) => (
              <ul {...props} style={{ marginLeft: "20px", marginTop: "8px", marginBottom: "8px" }} />
            ),
            ol: (props) => (
              <ol {...props} style={{ marginLeft: "20px", marginTop: "8px", marginBottom: "8px" }} />
            ),
            // Style code blocks
            code: (props) => {
              const { inline, ...rest } = props as React.HTMLAttributes<HTMLElement> & {
                inline?: boolean;
              };
              return inline ? (
                <code
                  {...rest}
                  style={{
                    background: "var(--panel-strong)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "0.9em",
                  }}
                />
              ) : (
                <code
                  {...rest}
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
              );
            },
            // Style blockquotes
            blockquote: (props) => (
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

