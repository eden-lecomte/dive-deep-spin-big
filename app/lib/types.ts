export type VoteLevel = "gold" | "silver" | "bronze";

export type WheelItem = {
  id: string;
  label: string;
  weight: number;
  imageUrl?: string;
  soundUrl?: string;
};

export type NoRepeatMode = "off" | "consecutive" | "session";

export type TeamState = { 
  mode: "teams" | "freeforall";
  teamA: string[]; 
  teamB: string[]; 
};

export type WheelSegment = WheelItem & {
  start: number;
  end: number;
  mid: number;
  color: string;
};

export type DraftItem = {
  label: string;
  weight: number;
  imageUrl: string;
  soundUrl: string;
};

export type VoteSummaryEntry = {
  item: WheelItem;
  level: VoteLevel;
};
