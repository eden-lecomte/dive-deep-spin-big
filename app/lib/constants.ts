import type { VoteLevel, WheelItem } from "./types";

export const DEFAULT_ITEMS: WheelItem[] = [
  { id: "game-1", label: "Apex Legends", weight: 1 },
  { id: "game-2", label: "Rocket League", weight: 1 },
  { id: "game-3", label: "Overwatch 2", weight: 1 },
  { id: "game-4", label: "Fortnite", weight: 1 },
  { id: "game-5", label: "Valorant", weight: 1 },
  { id: "game-6", label: "Sea of Thieves", weight: 1 },
];

export const COLORS = [
  "#7C4DFF",
  "#00BFA5",
  "#FF6D00",
  "#D500F9",
  "#00B0FF",
  "#FF1744",
  "#00E676",
  "#FFC400",
];

export const VOTE_WEIGHTS: Record<VoteLevel, number> = {
  gold: 1.2,
  silver: 1,
  bronze: 0.8,
};

export const SPIN_DURATION = 7000;
