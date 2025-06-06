import { useEffect, useState, useCallback } from 'react';
import type { GameState, WSMessage } from '../types/game';

// WebSocketのURL
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

// WebSocketクライアントフック
export const useWebSocket = (
  roomCode: string,
  playerName: string
) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPointsGained, setLastPointsGained] = useState<{ player: string; points: number; rulesAchieved?: {description: string}[] } | null>(null);
  const [hintMessage, setHintMessage] = useState<string | null>(null); // ヒントメッセージ用のstate

  // 接続処理
  useEffect(() => {
    // 既存のWebSocketがある場合は閉じる
    if (ws) {
      ws.close();
    }

    // 新しいWebSocketを作成
    const newWs = new WebSocket(WS_URL);

    // 接続イベント
    newWs.onopen = () => {
      console.log('WebSocket接続しました');
      setIsConnected(true);
      setError(null);
      
      // ルーム参加メッセージを送信
      newWs.send(JSON.stringify({
        type: 'join',
        roomCode,
        playerName
      }));
    };

    // エラーイベント
    newWs.onerror = (e) => {
      console.error('WebSocketエラー:', e);
      setError('サーバーに接続できませんでした。');
      setIsConnected(false);
    };

    // 切断イベント
    newWs.onclose = () => {
      console.log('WebSocket切断しました');
      setIsConnected(false);
      setError('サーバーから切断されました。');
    };

    // メッセージ受信イベント
    newWs.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        
        // メッセージタイプに応じた処理
        switch (data.type) {
          case 'gameState':
            setGameState(data.gameState);
            // gameStateが更新されたらエラーはクリアする（サーバー側で解決された可能性）
            // ただし、接続エラーや致命的なエラーは残す場合もあるので、状況に応じて調整
            if (error && !error.includes('接続')) {
                setError(null);
            }
            break;
          case 'error':
            setError(data.message);
            break;
          case 'pointGained':
            setLastPointsGained({
              player: data.player,
              points: data.points,
              rulesAchieved: data.rulesAchieved // 達成したルールの詳細
            });
            // 5秒後に通知を消す
            setTimeout(() => setLastPointsGained(null), 5000);
            break;
          case 'gameOver':
            // ゲーム終了メッセージに理由が含まれるようになったため、gameStateを更新してUI側で表示
            setGameState(prevState => prevState ? ({ ...prevState, winner: data.winner, gameOverReason: data.reason }) : null);
            break;
          case 'hint': // ヒントメッセージの処理
            setHintMessage(data.message);
            // 10秒後にヒントを消す（時間は調整可能）
            setTimeout(() => setHintMessage(null), 10000);
            break;
          case 'playerDisconnected':
            setError(`プレイヤー ${data.player} が切断しました`);
            // ゲーム状態も更新して、切断されたプレイヤーの情報を反映させるなどが必要な場合がある
            // ここではエラー表示のみ
            break;
          default:
            console.log('不明なメッセージタイプ:', data);
        }
      } catch (e) {
        console.error('メッセージのパースエラー:', e);
      }
    };

    // WebSocketを設定
    setWs(newWs);

    // クリーンアップ関数
    return () => {
      newWs.close();
    };
  }, [roomCode, playerName]);

  // 単語送信処理
  const sendWord = useCallback((word: string) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'word',
        word
      }));
    }
  }, [ws, isConnected]);

  // レート計算と保存（ゲーム終了時）
  useEffect(() => {
    if (gameState?.winner) {
      // レーティングを更新
      updateRating(playerName, gameState.winner === playerName);
    }
  }, [gameState?.winner, playerName]);

  return {
    gameState,
    error,
    isConnected,
    sendWord,
    lastPointsGained,
    hintMessage // hintMessageを返す
  };
};

// レーティング計算と保存
export const updateRating = (playerName: string, isWin: boolean) => {
  const RATING_KEY = 'shiritori-rating';
  const storedRating = localStorage.getItem(RATING_KEY);
  let ratings: Record<string, number> = {};

  // 既存のレーティングを取得
  if (storedRating) {
    try {
      ratings = JSON.parse(storedRating);
    } catch (e) {
      console.error('レーティングのパースエラー:', e);
    }
  }

  // プレイヤーのレーティングがなければ初期値を設定
  if (!ratings[playerName]) {
    ratings[playerName] = 1000;
  }

  // レーティング更新（勝利/敗北で±20）
  const ratingChange = isWin ? 20 : -20;
  ratings[playerName] += ratingChange;

  // レーティング保存
  localStorage.setItem(RATING_KEY, JSON.stringify(ratings));

  return {
    rating: ratings[playerName],
    change: ratingChange
  };
};

// プレイヤーのレーティングを取得
export const getPlayerRating = (playerName: string): number => {
  const RATING_KEY = 'shiritori-rating';
  const storedRating = localStorage.getItem(RATING_KEY);
  
  if (storedRating) {
    try {
      const ratings = JSON.parse(storedRating);
      return ratings[playerName] || 1000;
    } catch (e) {
      console.error('レーティングのパースエラー:', e);
    }
  }
  
  return 1000;
};
