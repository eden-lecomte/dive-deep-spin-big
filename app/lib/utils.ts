import type { WheelItem } from "./types";

export function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function weightedPick(items: WheelItem[]) {
  const total = items.reduce(
    (sum, item) => sum + Math.max(0.1, item.weight || 0),
    0
  );
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(0.1, item.weight || 0);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}
