export interface GameState {
  players: string[];
  history: string[];
  turn: number;
  hiddenRules: HiddenRule[];
  scores: { [player: string]: number };
  winner: string | null;
}

export interface HiddenRule {
  description: string;
}

export interface WSMessage {
  type: string;
  [key: string]: any;
}
