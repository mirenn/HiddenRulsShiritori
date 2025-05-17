export interface GameState {
  players: string[];
  history: string[];
  turn: number;
  hiddenRules: HiddenRule[];
  candidateHiddenRules: Omit<HiddenRule, 'achievedByPlayer'>[]; // 候補となる隠しルール (9つ)
  scores: { [player: string]: number };
  winner: string | null;
  wordsSaidCount?: { [player: string]: number }; // オプショナルに変更 (サーバーからの初期データに含まれない場合があるため)
  noPointTurns?: number; // オプショナルに変更
  gameOverReason?: string; // ゲーム終了理由を追加
  firstCharacter?: string; // ★追加
  historyDetails?: {
    player: string;
    word: string;
    points: number;
    rulesAchieved: { id: string; description: string }[];
  }[];
  geminiInteractions?: { prompt: string; response: string }[]; // Gemini APIとのやり取り履歴
}

export interface HiddenRule {
  id: string;
  description: string;
  points: number;
  achievedByPlayer: string | null; // null if not achieved, or player name
  // クライアント側では不要なプロパティは含めない
}

export interface WSMessage {
  type: string;
  [key: string]: any;
}
