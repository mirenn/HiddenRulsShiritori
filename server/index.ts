import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// 環境変数の読み込み
dotenv.config();

// Gemini APIレスポンスの型定義
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

// グローバルスコープに Gemini API 呼び出し関数を定義
const callGeminiAPIServer = async (prompt: string): Promise<boolean> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Gemini API key is not set on server.');
    return false;
  }
  const geminiApiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
  try {
    const response = await fetch(`${geminiApiEndpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) {
      console.error('Gemini API request failed on server:', response.status, await response.text());
      return false;
    }
    const data: GeminiResponse = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    return resultText === 'はい' || resultText === 'yes';
  } catch (error) {
    console.error('Error calling Gemini API on server:', error);
    return false;
  }
};

const app = express();
const port = process.env.PORT || 3000;

// CORS設定
app.use(cors());

// JSON処理のミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静的ファイルの提供
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../dist')));

// HTTPサーバーの作成
const server = http.createServer(app);

// WebSocketサーバーの作成
const wss = new WebSocketServer({ server });

// ルームの状態を保持するオブジェクト
interface GameState {
  players: string[];
  history: string[];
  turn: number;
  hiddenRules: HiddenRule[];
  scores: { [player: string]: number };
  winner: string | null;
  wordsSaidCount: { [player: string]: number }; // 各プレイヤーが言った単語数
  noPointTurns: number; // ポイント獲得なしの連続ターン数
  historyDetails?: {
    player: string;
    word: string;
    points: number;
    rulesAchieved: { id: string; description: string }[];
  }[];
}

interface HiddenRule {
  id: string; // ルール識別のためにidを追加
  description: string;
  points: number; // ポイントもサーバーで管理
  achievedByPlayer: string | null; // どのプレイヤーが達成したか
  checkFunction?: (word: string, apiKey?: string) => Promise<boolean> | boolean;
  needsApi?: boolean; // API呼び出しが必要なルールのフラグ
}

// ルーム管理用のマップ
const rooms = new Map<string, { 
  clients: Map<WebSocket, string>,
  gameState: GameState 
}>();

// WebSocketの接続イベント
wss.on('connection', (ws: WebSocket) => {
  let roomCode: string | null = null;
  let playerName: string | null = null;

  // メッセージ受信時の処理
  ws.on('message', async (messageData: Buffer | ArrayBuffer | Buffer[]) => {
    try {
      // バッファーを文字列に変換し、JSONとしてパース
      const message = messageData.toString();
      const data = JSON.parse(message);

      // 接続時の処理
      if (data.type === 'join') {
        roomCode = data.roomCode;
        playerName = data.playerName;

        // ルームが存在しない場合は作成
        if (roomCode && !rooms.has(roomCode)) {
          const initialHiddenRules = generateHiddenRules(); // ここで生成
          rooms.set(roomCode, {
            clients: new Map(),
            gameState: {
              players: [],
              history: [],
              historyDetails: [],
              turn: 0,
              hiddenRules: initialHiddenRules, // サーバー側で保持
              scores: {},
              winner: null,
              wordsSaidCount: {}, // 初期化
              noPointTurns: 0, // 初期化
            }
          });
        }

        // ルームの取得
        if (!roomCode) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'ルームコードが不正です'
          }));
          return;
        }
        const room = rooms.get(roomCode)!;
        
        // プレイヤーの追加
        if (playerName && !room.gameState.players.includes(playerName)) {
          // すでに2人いる場合は参加不可
          if (room.gameState.players.length >= 2) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'ルームが満員です'
            }));
            return;
          }

          room.gameState.players.push(playerName);
          room.gameState.scores[playerName] = 0;
          room.gameState.wordsSaidCount[playerName] = 0; // 初期化
        }

        // クライアントの追加
        if (playerName) {
          room.clients.set(ws, playerName);
        }

        // ゲーム状態を送信
        ws.send(JSON.stringify({
          type: 'gameState',
          gameState: {
            ...room.gameState,
            // 隠しルールの詳細(checkFunctionやneedsApi)はクライアントに送信しない
            hiddenRules: room.gameState.hiddenRules.map(({ id, description, points, achievedByPlayer }) => ({ id, description, points, achievedByPlayer }))
          }
        }));

        // ルーム内の全クライアントに更新を通知
        broadcastGameState(roomCode);
      }

      // 単語送信時の処理 (ルールチェックをサーバーサイドで行うように変更)
      if (data.type === 'word' && roomCode && playerName) {
        const room = rooms.get(roomCode);
        if (!room) return;

        const gameState = room.gameState;
        const word = data.word;

        // プレイヤーのインデックスを取得
        const playerIndex = gameState.players.indexOf(playerName);
        
        // ターンチェック
        if (playerIndex !== gameState.turn) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '相手のターンです'
          }));
          return;
        }

        // しりとりルールのチェック
        if (gameState.history.length > 0) {
          const prevWord = gameState.history[gameState.history.length - 1];
          const lastChar = prevWord.endsWith('ー') ? prevWord.charAt(prevWord.length - 2) : prevWord.charAt(prevWord.length - 1);
          const firstChar = word.startsWith('ー') ? word.charAt(1) : word.charAt(0);
          if (firstChar.toLowerCase() !== lastChar.toLowerCase()) { // 大文字・小文字を区別しない
            ws.send(JSON.stringify({
              type: 'error',
              message: '前の単語の最後の文字で始めてください'
            }));
            return;
          }
        }

        // 「ん」で終わるチェック
        const nEndingRule = gameState.hiddenRules.find(rule => rule.id === 'rule_n_ending');
        let isNEndingAllowedByRule = false;
        if (nEndingRule && nEndingRule.checkFunction) {
          if (nEndingRule.needsApi) {
            isNEndingAllowedByRule = await nEndingRule.checkFunction(word, process.env.GEMINI_API_KEY);
          } else {
            isNEndingAllowedByRule = nEndingRule.checkFunction(word) as boolean;
          }
        }

        if ((word.endsWith('ん') || word.endsWith('ン')) && !isNEndingAllowedByRule) {
          ws.send(JSON.stringify({ type: 'error', message: '「ん」で終わる単語は使えません (特別なルールがない限り)' }));
          return;
        }

        // 単語を言った数をカウント
        gameState.wordsSaidCount[playerName] = (gameState.wordsSaidCount[playerName] || 0) + 1;

        // 履歴に追加
        gameState.history.push(word);

        // 隠しルールのチェックとポイント加算
        let pointsGainedThisTurn = 0;
        const achievedRulesInfo: { ruleId: string; description: string; points: number; }[] = [];
        for (const rule of gameState.hiddenRules) {
          if (rule.achievedByPlayer === null || rule.achievedByPlayer === playerName) { // まだ誰も達成していないか、自分が達成済みのルールのみポイント加算のチャンス
            let ruleMet = false;
            if (rule.needsApi && rule.checkFunction) {
              ruleMet = await rule.checkFunction(word, process.env.GEMINI_API_KEY);
            } else if (rule.checkFunction) {
              ruleMet = rule.checkFunction(word) as boolean;
            }

            if (ruleMet) {
              pointsGainedThisTurn += rule.points;
              // gameState.scores[playerName] += rule.points; // ポイントはまとめて加算
              if (rule.achievedByPlayer === null) { // 初めてこのルールを達成した場合
                rule.achievedByPlayer = playerName; // 達成者を記録 (クライアントには送信しない内部状態)
              }
              achievedRulesInfo.push({ ruleId: rule.id, description: rule.description, points: rule.points});
            }
          }
        }
        
        // ポイント加算
        if (pointsGainedThisTurn > 0) {
          gameState.scores[playerName] += pointsGainedThisTurn;
          gameState.noPointTurns = 0; // ポイント獲得したのでリセット
          // ポイント獲得通知 (どのルールで獲得したかも含める)
          room.clients.forEach((clientName, client) => {
            client.send(JSON.stringify({
              type: 'pointGained',
              player: playerName,
              points: pointsGainedThisTurn,
              rulesAchieved: achievedRulesInfo, // 達成したルールの詳細
              newScore: gameState.scores[playerName!],
              // 更新されたhiddenRulesの状態も送る (achievedByPlayerが更新されているため)
              updatedHiddenRules: gameState.hiddenRules.map(({ id, description, points, achievedByPlayer }) => ({ id, description, points, achievedByPlayer }))
            }));
          });
        } else {
          gameState.noPointTurns++; // ポイント獲得なし
        }
        
        // 勝利判定
        if (gameState.scores[playerName] >= 5) {
          gameState.winner = playerName;
          
          // 勝利通知
          room.clients.forEach((clientName, client) => {
            client.send(JSON.stringify({
              type: 'gameOver',
              winner: playerName
            }));
          });
          broadcastGameState(roomCode); // 状態更新を通知して終了
          return;
        }

        // 終了判定 (各プレイヤーが10単語言い終わったか)
        const allPlayersSaid10Words = gameState.players.every(
          player => (gameState.wordsSaidCount[player] || 0) >= 10
        );

        if (allPlayersSaid10Words) {
          // ポイントが多いプレイヤーを勝者とする
          let maxScore = -1;
          let winners: string[] = [];
          for (const player of gameState.players) {
            if (gameState.scores[player] > maxScore) {
              maxScore = gameState.scores[player];
              winners = [player];
            } else if (gameState.scores[player] === maxScore) {
              winners.push(player);
            }
          }
          gameState.winner = winners.length === 1 ? winners[0] : 'draw'; // 引き分けも考慮
          
          room.clients.forEach((clientName, client) => {
            client.send(JSON.stringify({
              type: 'gameOver',
              winner: gameState.winner,
              reason: 'allPlayersSaid10Words'
            }));
          });
          broadcastGameState(roomCode); // 状態更新を通知して終了
          return;
        }

        // ポイント加算や勝利判定などの直後に履歴詳細を追加
        if (!gameState.historyDetails) gameState.historyDetails = [];
        gameState.historyDetails.push({
          player: playerName,
          word,
          points: pointsGainedThisTurn,
          rulesAchieved: achievedRulesInfo.map(r => ({ id: r.ruleId, description: r.description }))
        });

        // ヒント機能
        if (gameState.noPointTurns >= 2) {
          const unachievedRules = gameState.hiddenRules.filter(rule => rule.achievedByPlayer === null);
          if (unachievedRules.length > 0) {
            const hintRule = unachievedRules[Math.floor(Math.random() * unachievedRules.length)];
            const dummyRuleDescriptions = generateDummyRuleDescriptions(allServerRules, hintRule, 2);
            const hintOptions = [hintRule.description, ...dummyRuleDescriptions].sort(() => 0.5 - Math.random());

            room.clients.forEach((clientName, client) => {
              client.send(JSON.stringify({
                type: 'hint',
                hintTargetRuleId: hintRule.id, // どのルールに対するヒントか（デバッグ用、クライアント表示は任意）
                options: hintOptions,
                message: `ヒント：隠し条件のうち一つは次のいずれかです： ${hintOptions.join('、')}`
              }));
            });
            gameState.noPointTurns = 0; // ヒントを出したらリセット
          }
        }

        // ターン交代
        gameState.turn = (gameState.turn + 1) % gameState.players.length;

        // 全クライアントに更新通知
        broadcastGameState(roomCode);
      }

      // 新しいメッセージタイプ: ルールチェックリクエスト (クライアントからは直接使わない想定だが、将来的な拡張のため残す)
      if (data.type === 'checkRule' && roomCode && playerName) {
        const { word, ruleId } = data;
        const room = rooms.get(roomCode);
        if (!room) return;

        const rule = room.gameState.hiddenRules.find(r => r.id === ruleId);
        if (rule && rule.checkFunction) {
          let result = false;
          if (rule.needsApi) {
            result = await callGeminiAPIServer(`「${word}」は「${rule.description}」の条件を満たしますか？ はい、いいえで答えてください。`);
          } else {
            result = rule.checkFunction(word) as boolean;
          }
          ws.send(JSON.stringify({ type: 'ruleCheckResult', ruleId, result }));
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'メッセージの処理中にエラーが発生しました'
      }));
    }
  });

  // クライアント切断時の処理
  ws.on('close', () => {
    if (roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode)!;
      room.clients.delete(ws);
      
      // クライアントが全ていなくなったらルームを削除
      if (room.clients.size === 0) {
        rooms.delete(roomCode);
      } else {
        // 切断通知
        room.clients.forEach((clientName, client) => {
          client.send(JSON.stringify({
            type: 'playerDisconnected',
            player: playerName
          }));
        });
      }
    }
  });
});

// サーバーサイドの全ルールリスト (generateHiddenRules内から移動)
const allServerRules: Omit<HiddenRule, 'achievedByPlayer'>[] = [
  { id: 'rule1', description: '3文字の単語', points: 1, checkFunction: (word) => word.length === 3 },
  { id: 'rule_n_ending', description: '「ん」で終わる単語 (通常は反則)', points: 2, checkFunction: (word) => word.endsWith('ん') || word.endsWith('ン') },
  { id: 'rule3', description: '食べ物の名前', points: 1, needsApi: true, checkFunction: async (word) => await callGeminiAPIServer(`「${word}」は食べ物の名前ですか？ はい、いいえで答えてください。`) },
  { id: 'rule4', description: '動物の名前', points: 1, needsApi: true, checkFunction: async (word) => await callGeminiAPIServer(`「${word}」は動物の名前ですか？ はい、いいえで答えてください。`) },
  { id: 'rule5', description: '色を表す単語', points: 1, needsApi: true, checkFunction: async (word) => await callGeminiAPIServer(`「${word}」は色を表す単語ですか？ はい、いいえで答えてください。`) },
  { id: 'rule6', description: 'ひらがな5文字以上の単語', points: 2, checkFunction: (word) => word.length >= 5 && /^[ぁ-んー]+$/.test(word) },
  { id: 'rule7', description: 'ひらがなの単語', points: 1, checkFunction: (word) => /^[ぁ-んー]+$/.test(word) },
  { id: 'rule8', description: '最後に「り」がつく言葉', points: 1, checkFunction: (word) => word.endsWith('り') },
  { id: 'rule9', description: '「ぱ」から始まる単語', points: 2, checkFunction: (word) => word.startsWith('パ') },
  { id: 'rule11', description: '植物の名前', points: 1, needsApi: true, checkFunction: async (word) => await callGeminiAPIServer(`「${word}」は植物の名前ですか？ はい、いいえで答えてください。`) },
  { id: 'rule12', description: '乗り物の名前', points: 1, needsApi: true, checkFunction: async (word) => await callGeminiAPIServer(`「${word}」は乗り物の名前ですか？ はい、いいえで答えてください。`) },
  { id: 'rule13', description: '同じ文字が2つ続く単語 (例: りんご、バナナ)', points: 2, checkFunction: (word) => /(\p{L})\1/u.test(word) },
  { id: 'rule14', description: '最初の文字と最後の文字が同じ単語', points: 2, checkFunction: (word) => word.length > 1 && word.charAt(0) === word.charAt(word.length - 1) },
  { id: 'rule15', description: '天候に関する言葉', points: 1, needsApi: true, checkFunction: async (word) => await callGeminiAPIServer(`「${word}」は天候に関する言葉ですか？ はい、いいえで答えてください。`) },
  { id: 'rule16', description: 'スポーツの名前', points: 1, needsApi: true, checkFunction: async (word) => await callGeminiAPIServer(`「${word}」はスポーツの名前ですか？ はい、いいえで答えてください。`) },
  { id: 'rule17', description: '「き」で終わる3文字の単語', points: 2, checkFunction: (word) => word.length === 3 && word.endsWith('き') },
  { id: 'rule18', description: '国名', points: 2, needsApi: true, checkFunction: async (word) => await callGeminiAPIServer(`「${word}」は国名ですか？ はい、いいえで答えてください。`) },
  { id: 'rule19', description: '楽器の名前', points: 1, needsApi: true, checkFunction: async (word) => await callGeminiAPIServer(`「${word}」は楽器の名前ですか？ はい、いいえで答えてください。`) },
  { id: 'rule20', description: 'ひらがなのみで構成される4文字の単語', points: 1, checkFunction: (word) => word.length === 4 && /^[ぁ-んー]+$/.test(word) },
];

// 隠しルールを生成する関数 (サーバーサイドで定義)
// ルール定義にid, points, needsApi, checkFunctionを追加
function generateHiddenRules(): HiddenRule[] {
  const shuffled = [...allServerRules].sort(() => 0.5 - Math.random());
  // achievedByPlayer を null で初期化して完全な HiddenRule 型にする
  return shuffled.slice(0, 3).map(rule => ({ ...rule, achievedByPlayer: null } as HiddenRule));
}

// ダミーのルール説明を生成する関数 (ヒント用)
function generateDummyRuleDescriptions(allRules: Omit<HiddenRule, 'achievedByPlayer'>[], excludeRule: HiddenRule, count: number): string[] {
  const candidates = allRules.filter(rule => rule.id !== excludeRule.id);
  const shuffled = [...candidates].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(rule => rule.description);
}

// ゲーム状態をルーム内の全クライアントに送信
function broadcastGameState(roomCode: string) {
  if (!roomCode) return; // roomCodeがnullやundefinedの場合は何もしない
  const room = rooms.get(roomCode);
  if (!room) return;

  const broadcastData = JSON.stringify({
    type: 'gameState',
    gameState: {
      ...room.gameState,
      hiddenRules: room.gameState.hiddenRules.map(({ id, description, points, achievedByPlayer }) => ({ id, description, points, achievedByPlayer }))
    }
  });

  room.clients.forEach((_playerName, client) => {
    client.send(broadcastData);
  });
}

// API: Geminiの隠しルール生成APIを実装
app.post('/api/generate-hidden-rules', async (req: Request, res: Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'GEMINI_API_KEYが設定されていません' });
      return;
    }

    // TODO: Gemini APIを使用して動的な隠しルールを生成する実装
    // 現在はダミーデータを返しています
    const dummyRules = [
      { description: '食べ物を表す単語' },
      { description: '4文字の単語' },
      { description: '「あ」を含む単語' }
    ];

    res.json({ rules: dummyRules });
    return;
  } catch (error) {
    console.error('Error generating hidden rules:', error);
    res.status(500).json({ error: '隠しルールの生成に失敗しました' });
    return;
  }
});

// 隠しルール判定API（Gemini API経由）
app.post('/api/check-hidden-rule', async (req: Request, res: Response) => {
  const { word, ruleId } = req.body;
  if (!word || !ruleId) {
    res.status(400).json({ result: false, error: 'wordとruleIdは必須です' });
    return;
  }
  // ルールごとにGemini APIプロンプトを切り替え
  let prompt = '';
  switch (ruleId) {
    case 'rule3':
      prompt = `「${word}」は食べ物の名前ですか？ はい、いいえで答えてください。`;
      break;
    case 'rule4':
      prompt = `「${word}」は動物の名前ですか？ はい、いいえで答えてください。`;
      break;
    case 'rule5':
      prompt = `「${word}」は色を表す単語ですか？ はい、いいえで答えてください。`;
      break;
    default:
      res.status(400).json({ result: false, error: 'このルールIDはAPI判定に未対応です' });
      return;
  }
  const result = await callGeminiAPIServer(prompt);
  res.json({ result });
  return;
});

// すべてのリクエストをindex.htmlにリダイレクト（SPAのため）
app.get('/*splat', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// サーバーの起動
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
