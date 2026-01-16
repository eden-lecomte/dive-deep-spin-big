"use client";

import { useEffect } from "react";

type VictoryModalProps = {
  winners: string[];
  onClose: () => void;
};

export default function VictoryModal({ winners, onClose }: VictoryModalProps) {
  useEffect(() => {
    // Reset timer whenever winners change
    const timer = setTimeout(() => {
      onClose();
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, [winners, onClose]); // Depend on winners so timer resets when new winners are added

  return (
    <div className="victory-modal-overlay">
      <div className="victory-modal-content">
        <div className="victory-gif-container">
          {/* Space for victory gif - can be added later */}
        </div>
        <div className="victory-winners">
          <h2 className="victory-title">Victory!</h2>
          <div className="victory-names">
            {winners.map((winner, index) => (
              <div key={index} className="victory-name">
                {winner}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
