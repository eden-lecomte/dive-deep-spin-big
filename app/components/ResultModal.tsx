"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { TeamState, WheelItem } from "../lib/types";
import TeamsSection from "./TeamsSection";

type ResultModalProps = {
  item: WheelItem;
  soundMuted: boolean;
  onClose: () => void;
  onAutoCreateTeams?: () => void;
  teamState: TeamState | null;
  teamShuffle: boolean;
  adminUnlocked: boolean;
};

export default function ResultModal({
  item,
  soundMuted,
  onClose,
  onAutoCreateTeams,
  teamState,
  teamShuffle,
  adminUnlocked,
}: ResultModalProps) {
  const autoTeamsTriggeredRef = useRef(false);

  useEffect(() => {
    if (!item.soundUrl || soundMuted) return;
    const audio = new Audio(item.soundUrl);
    audio.volume = 0.5;
    audio.play().catch(() => null);
  }, [item.soundUrl, soundMuted]);

  useEffect(() => {
    if (autoTeamsTriggeredRef.current) return;
    autoTeamsTriggeredRef.current = true;
    onAutoCreateTeams?.();
  }, [onAutoCreateTeams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 30000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="victory-modal-overlay" onClick={onClose}>
      <div className="result-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="victory-gif-container">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.label}
              className="result-image"
              width={360}
              height={240}
              unoptimized
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
              No image selected for this game
            </p>
          )}
        </div>
        <div className="victory-winners">
          <h2 className="victory-title">{item.label}</h2>
          {teamState && (
            <TeamsSection
              teamState={teamState}
              teamShuffle={teamShuffle}
              adminUnlocked={adminUnlocked}
              landedItemLabel={item.label}
              showControls={false}
            />
          )}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
            <button className="ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
