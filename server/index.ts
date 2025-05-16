import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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

// ルームの状態を保持するオブジェクト
interface GameState {
  players: string[];
  history: string[];
  turn: number;
  hiddenRules: HiddenRule[];
  scores: { [player: string]: number };
  winner: string | null;
}

interface HiddenRule {
  description: string;
  checkFunction: (word: string) => boolean;
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
  ws.on('message', (message: string) => {
    const data = JSON.parse(message);

    // 接続時の処理
    if (data.type === 'join') {
      roomCode = data.roomCode;
      playerName = data.playerName;

      // ルームが存在しない場合は作成
      if (!rooms.has(roomCode)) {
        const hiddenRules = generateHiddenRules();
        rooms.set(roomCode, {
          clients: new Map(),
          gameState: {
            players: [],
            history: [],
            turn: 0,
            hiddenRules,
            scores: {},
            winner: null
          }
        });
      }

      // ルームの取得
      const room = rooms.get(roomCode)!;
      
      // プレイヤーの追加
      if (!room.gameState.players.includes(playerName)) {
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
      }

      // クライアントの追加
      room.clients.set(ws, playerName);

      // ゲーム状態を送信
      ws.send(JSON.stringify({
        type: 'gameState',
        gameState: {
          ...room.gameState,
          // 隠しルールの評価関数はクライアントに送信しない
          hiddenRules: room.gameState.hiddenRules.map(rule => ({ description: rule.description }))
        }
      }));

      // ルーム内の全クライアントに更新を通知
      broadcastGameState(roomCode);
    }

    // 単語送信時の処理
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
        const lastChar = prevWord[prevWord.length - 1];
        if (word[0] !== lastChar) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '前の単語の最後の文字で始めてください'
          }));
          return;
        }
      }

      // 「ん」で終わるチェック
      if (word[word.length - 1] === 'ん') {
        ws.send(JSON.stringify({
          type: 'error',
          message: '「ん」で終わる単語は使えません'
        }));
        return;
      }

      // 履歴に追加
      gameState.history.push(word);

      // 隠しルールのチェックとポイント加算
      let pointsGained = 0;
      gameState.hiddenRules.forEach(rule => {
        if (rule.checkFunction(word)) {
          pointsGained++;
        }
      });

      // ポイント加算
      if (pointsGained > 0) {
        gameState.scores[playerName] += pointsGained;
        
        // ポイント獲得通知
        room.clients.forEach((clientName, client) => {
          client.send(JSON.stringify({
            type: 'pointGained',
            player: playerName,
            points: pointsGained
          }));
        });
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
      }

      // ターン交代
      gameState.turn = (gameState.turn + 1) % gameState.players.length;

      // 全クライアントに更新通知
      broadcastGameState(roomCode);
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

// 隠しルールを生成する関数
function generateHiddenRules(): HiddenRule[] {
  const rules: HiddenRule[] = [
    {
      description: '動物を表す単語',
      checkFunction: (word: string) => {
        const animals = ['いぬ', 'ねこ', 'うさぎ', 'とり', 'うし', 'うま', 'さる', 'きりん', 'ぞう', 'らいおん', 'とら', 'くま'];
        return animals.includes(word);
      }
    },
    {
      description: '3文字の単語',
      checkFunction: (word: string) => word.length === 3
    },
    {
      description: '「か」で始まる単語',
      checkFunction: (word: string) => word[0] === 'か'
    }
  ];
  
  // ランダムに3つ選択
  const selectedRules: HiddenRule[] = [];
  while (selectedRules.length < 3 && rules.length > 0) {
    const randomIndex = Math.floor(Math.random() * rules.length);
    selectedRules.push(rules[randomIndex]);
    rules.splice(randomIndex, 1);
  }
  
  return selectedRules;
}

// ゲーム状態をルーム内の全クライアントに送信
function broadcastGameState(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const broadcastData = JSON.stringify({
    type: 'gameState',
    gameState: {
      ...room.gameState,
      // 隠しルールの評価関数はクライアントに送信しない
      hiddenRules: room.gameState.hiddenRules.map(rule => ({ description: rule.description }))
    }
  });

  room.clients.forEach((_playerName, client) => {
    client.send(broadcastData);
  });
}

// API: Geminiの隠しルール生成APIを実装
app.post('/api/generate-hidden-rules', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEYが設定されていません' });
    }

    // TODO: Gemini APIを使用して動的な隠しルールを生成する実装
    // 現在はダミーデータを返しています
    const dummyRules = [
      { description: '食べ物を表す単語' },
      { description: '4文字の単語' },
      { description: '「あ」を含む単語' }
    ];

    res.json({ rules: dummyRules });
  } catch (error) {
    console.error('Error generating hidden rules:', error);
    res.status(500).json({ error: '隠しルールの生成に失敗しました' });
  }
});

// すべてのリクエストをindex.htmlにリダイレクト（SPAのため）
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// サーバーの起動
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
