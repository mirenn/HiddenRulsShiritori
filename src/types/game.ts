export interface GameState {
  players: string[];
  history: string[];
  turn: number;
  hiddenRules: HiddenRule[];
  scores: { [player: string]: number };
  winner: string | null;
}

export interface HiddenRule {
  id: string;
  description: string;
  points: number;
  achievedByPlayer: string | null; // null if not achieved, or player name
}

export interface WSMessage {
  type: string;
  [key: string]: any;
}
