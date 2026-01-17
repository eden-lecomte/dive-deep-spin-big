"use client";

import { useEffect, useState } from "react";
import { getRandomVictoryGif } from "../lib/victoryGifs";

type VictoryModalProps = {
  winners: string[];
  onClose: () => void;
};

// Same hash function as HeaderBar to ensure consistent colors
function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Same player style function as HeaderBar to match colors
function playerStyle(name: string) {
  const hue = hashString(name) % 360;
  return {
    background: `hsla(${hue}, 70%, 60%, 0.18)`,
    borderColor: `hsla(${hue}, 70%, 60%, 0.5)`,
    color: `hsl(${hue}, 80%, 80%)`,
  };
}

export default function VictoryModal({ winners, onClose }: VictoryModalProps) {
  const [victoryGif, setVictoryGif] = useState<string | null>(null);

  useEffect(() => {
    // Load a random victory GIF when modal opens
    getRandomVictoryGif().then(setVictoryGif);
  }, []);

  useEffect(() => {
    // Reset timer whenever winners change
    const timer = setTimeout(() => {
      onClose();
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, [winners, onClose]);

  return (
    <div className="victory-modal-overlay">
      <div className="victory-modal-content">
        <div className="victory-gif-container">
          {victoryGif ? (
            <img
              src={victoryGif}
              alt="Victory celebration"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
              }}
            />
          ) : (
            <p className="subtle" style={{ textAlign: "center", padding: "20px" }}>
              Add GIF files to <code>public/assets/victory-gifs/</code> to see victory animations
            </p>
          )}
        </div>
        <div className="victory-winners">
          <h2 className="victory-title">Victory!</h2>
          <div className="victory-names">
            {winners.map((winner, index) => (
              <div key={index} className="victory-name" style={playerStyle(winner)}>
                {winner}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
