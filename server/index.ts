import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// gameLogic.tsから必要なものをインポート
import {
  GameState,
  HiddenRule,
  allServerRules, // allServerRulesをインポート
  generateHiddenRules,
  generateCandidateHiddenRules,
  getRandomHiragana,
  processPlayerWord,
  callGeminiAPIServer // callGeminiAPIServerをインポート
} from './gameLogic';

// 環境変数の読み込み
dotenv.config();

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
          const actualHiddenRules = generateHiddenRules(); // 実際の隠しルール3つ
          const candidateRules = generateCandidateHiddenRules(actualHiddenRules, allServerRules); // 候補のルール9つ
          const firstCharacter = getRandomHiragana(); // ★追加: 最初の文字をランダムに決定
          rooms.set(roomCode, {
            clients: new Map(),
            gameState: {
              players: [],
              history: [],
              historyDetails: [],
              turn: 0,
              hiddenRules: actualHiddenRules, // サーバー側で保持
              candidateHiddenRules: candidateRules, // 候補も保持
              scores: {},
              winner: null,
              wordsSaidCount: {}, // 初期化
              noPointTurns: 0, // 初期化
              firstCharacter, // ★追加
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
            hiddenRules: room.gameState.hiddenRules.map(({ id, description, points, achievedByPlayer }) => ({ id, description, points, achievedByPlayer })),
            // candidateHiddenRules も同様に、必要な情報のみ送信
            candidateHiddenRules: room.gameState.candidateHiddenRules.map(({ id, description, points }) => ({ id, description, points }))
          }
        }));

        // ルーム内の全クライアントに更新を通知
        broadcastGameState(roomCode);
      }

      // 単語送信時の処理 (ルールチェックをサーバーサイドで行うように変更)
      if (data.type === 'word' && roomCode && playerName) {
        const { word } = data;
        const room = rooms.get(roomCode);
        if (!room) return;

        const gameState = room.gameState;

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

        // gameLogic.tsのprocessPlayerWord関数を呼び出す
        const gameResult = await processPlayerWord(gameState, playerName, word, ws, process.env.GEMINI_API_KEY);

        if (gameResult.error) {
          // エラーメッセージはprocessPlayerWord内で送信されるので、ここでは何もしないか、ログ記録など
          console.log(`Error for player ${playerName} in room ${roomCode}: ${gameResult.error}`);
          return;
        }

        if (gameResult.pointsGainedThisTurn !== undefined && gameResult.pointsGainedThisTurn > 0) {
          // ポイント獲得通知
          room.clients.forEach((clientName, client) => {
            client.send(JSON.stringify({
              type: 'pointGained',
              player: playerName,
              points: gameResult.pointsGainedThisTurn,
              rulesAchieved: gameResult.achievedRulesInfo,
              newScore: gameState.scores[playerName!],
              updatedHiddenRules: gameState.hiddenRules.map(({ id, description, points, achievedByPlayer }) => ({ id, description, points, achievedByPlayer }))
            }));
          });
        }

        if (gameResult.hint) {
          room.clients.forEach((clientName, client) => {
            client.send(JSON.stringify({
              type: 'hint',
              hintTargetRuleId: gameResult.hint!.hintTargetRuleId,
              options: gameResult.hint!.options,
              message: gameResult.hint!.message
            }));
          });
        }

        if (gameResult.gameOver) {
          room.clients.forEach((clientName, client) => {
            client.send(JSON.stringify({
              type: 'gameOver',
              winner: gameResult.winner,
              reason: gameResult.reason
            }));
          });
          broadcastGameState(roomCode);
          return;
        }

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

// ゲーム状態をルーム内の全クライアントに送信
function broadcastGameState(roomCode: string) {
  if (!roomCode) return; // roomCodeがnullやundefinedの場合は何もしない
  const room = rooms.get(roomCode);
  if (!room) return;

  const broadcastData = JSON.stringify({
    type: 'gameState',
    gameState: {
      ...room.gameState,
      hiddenRules: room.gameState.hiddenRules.map(({ id, description, points, achievedByPlayer }) => ({ id, description, points, achievedByPlayer })),
      candidateHiddenRules: room.gameState.candidateHiddenRules.map(({ id, description, points }) => ({ id, description, points }))
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
    case 'rule11':
      prompt = `「${word}」は植物の名前ですか？ はい、いいえで答えてください。`;
      break;
    case 'rule12':
      prompt = `「${word}」は乗り物の名前ですか？ はい、いいえで答えてください。`;
      break;
    case 'rule15':
      prompt = `「${word}」は天候に関する言葉ですか？ はい、いいえで答えてください。`;
      break;
    case 'rule16':
      prompt = `「${word}」はスポーツの名前ですか？ はい、いいえで答えてください。`;
      break;
    case 'rule19':
      prompt = `「${word}」は楽器の名前ですか？ はい、いいえで答えてください。`;
      break;
    case 'rule20':
      prompt = `「${word}」は丸い形を連想させる言葉ですか？ はい、いいえで答えてください。`;
      break;
    case 'rule21':
      prompt = `「${word}」は柔らかいものを表す言葉ですか？ はい、いいえで答えてください。`;
      break;
    case 'rule22':
      prompt = `「${word}」は甘いものを表す言葉ですか？ はい、いいえで答えてください。`;
      break;
    case 'rule23':
      prompt = `「${word}」は夏を連想させる言葉ですか？ はい、いいえで答えてください。`;
      break;
    default:
      res.status(400).json({ result: false, error: 'このルールIDはAPI判定に未対応です' });
      return;
  }
  const result = await callGeminiAPIServer(prompt, process.env.GEMINI_API_KEY); // APIキーを渡す
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
