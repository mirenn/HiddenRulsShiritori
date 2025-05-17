export interface GameState {
  players: string[];
  history: string[];
  turn: number;
  hiddenRules: HiddenRule[];
  scores: { [player: string]: number };
  winner: string | null;
  wordsSaidCount?: { [player: string]: number }; // オプショナルに変更 (サーバーからの初期データに含まれない場合があるため)
  noPointTurns?: number; // オプショナルに変更
  gameOverReason?: string; // ゲーム終了理由を追加
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
