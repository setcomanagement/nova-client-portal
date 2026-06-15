"use client";

// Catches errors in the root layout itself; must render its own <html>/<body>.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f4ece0",
          color: "#2a1f17",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 1rem" }}>
          <h1 style={{ fontSize: "1.5rem" }}>NOVA — something went wrong</h1>
          <p style={{ color: "#6b5a45" }}>The app hit an unexpected error.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              height: 40,
              padding: "0 1.25rem",
              borderRadius: 8,
              border: "none",
              background: "#a0703c",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
