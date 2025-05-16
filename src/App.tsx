import { useState, useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import RatingDisplay from './components/RatingDisplay'

function ShiritoriGame({ roomCode, playerName }: { roomCode: string; playerName: string }) {
  const [input, setInput] = useState('')
  const [ratingChange, setRatingChange] = useState<number>(0)
  const [showGameSummary, setShowGameSummary] = useState(false)
  
  // WebSocket接続とゲーム状態管理
  const { 
    gameState, 
    error, 
    isConnected, 
    sendWord,
    lastPointsGained
  } = useWebSocket(roomCode, playerName)

  // 入力処理
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // 送信処理
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input) return
    
    sendWord(input)
    setInput('')
  }

  // ゲーム終了時の処理
  useEffect(() => {
    if (gameState?.winner) {
      // 勝者かどうかでレート変動を設定
      setRatingChange(gameState.winner === playerName ? 20 : -20)
      setShowGameSummary(true)
    }
  }, [gameState?.winner, playerName])

  // プレイヤーの自分のインデックスを取得
  const myIndex = gameState?.players.indexOf(playerName) ?? -1
  
  // 自分のターンかどうか
  const isMyTurn = gameState?.turn === myIndex

  // 接続中の表示
  if (!isConnected || !gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-50">
        <div className="bg-white p-8 rounded shadow-md w-96">
          <h2 className="text-xl font-bold mb-4">ルーム: {roomCode}</h2>
          <p className="mb-2">プレイヤー名: {playerName}</p>
          <p className="mb-4">
            {error || "サーバーに接続中..."}
          </p>
          <div className="animate-pulse flex justify-center">
            <div className="h-4 w-4 bg-blue-600 rounded-full mx-1"></div>
            <div className="h-4 w-4 bg-blue-600 rounded-full mx-1 animate-delay-200"></div>
            <div className="h-4 w-4 bg-blue-600 rounded-full mx-1 animate-delay-400"></div>
          </div>
        </div>
      </div>
    )
  }

  // プレイヤーが1人しかいない場合の表示
  if (gameState.players.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-50">
        <div className="bg-white p-8 rounded shadow-md w-96">
          <h2 className="text-xl font-bold mb-4">ルーム: {roomCode}</h2>
          <p className="mb-2">プレイヤー名: {playerName}</p>
          <p className="mb-4">待機中...（もう1人の参加を待っています）</p>
          <RatingDisplay playerName={playerName} />
          <div className="mt-4">
            <p>参加者:</p>
            <ul className="mb-2">
              {gameState.players.map((p) => (
                <li key={p} className="flex justify-between">
                  <span>{p}</span>
                  <RatingDisplay playerName={p} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // ゲーム終了表示
  if (showGameSummary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-50">
        <div className="bg-white p-8 rounded shadow-md w-96">
          <h2 className="text-xl font-bold mb-4 text-center">ゲーム終了</h2>
          <p className="text-center mb-6 text-2xl">
            {gameState.winner === playerName ? '勝利しました！' : '敗北しました...'}
          </p>
          
          <div className="mb-6">
            <h3 className="font-bold mb-2">隠しルール一覧</h3>
            <ul className="list-disc pl-5">
              {gameState.hiddenRules.map((rule, i) => (
                <li key={i}>{rule.description}</li>
              ))}
            </ul>
          </div>
          
          <div className="mb-6">
            <h3 className="font-bold mb-2">最終スコア</h3>
            {gameState.players.map(player => (
              <div key={player} className="flex justify-between items-center">
                <span className={player === gameState.winner ? 'font-bold' : ''}>
                  {player} {player === gameState.winner && '👑'}
                </span>
                <span>{gameState.scores[player]}ポイント</span>
              </div>
            ))}
          </div>
          
          <div className="mb-6">
            <h3 className="font-bold mb-2">レーティング変動</h3>
            {gameState.players.map(player => (
              <div key={player} className="flex justify-between items-center">
                <span>{player}</span>
                <RatingDisplay 
                  playerName={player} 
                  showChange={true} 
                  ratingChange={player === gameState.winner ? 20 : -20}
                />
              </div>
            ))}
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            新しいゲームを始める
          </button>
        </div>
      </div>
    )
  }

  // ゲーム進行中の表示
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-50">
      <div className="bg-white p-8 rounded shadow-lg w-full max-w-2xl">
        {/* ヘッダー部分 */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">ルーム: {roomCode}</h2>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg">{isMyTurn ? 'あなたのターン' : '相手のターン'}</p>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        
        {/* ポイント獲得通知 */}
        {lastPointsGained && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded mb-4 animate-pulse">
            <strong>{lastPointsGained.player}</strong>が条件を満たして<strong>{lastPointsGained.points}ポイント</strong>獲得しました！
          </div>
        )}

        {/* プレイヤー情報 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {gameState.players.map((player, index) => (
            <div 
              key={player} 
              className={`p-4 rounded-lg ${player === playerName ? 'bg-blue-100' : 'bg-gray-100'} 
                         ${gameState.turn === index ? 'border-2 border-green-500' : ''}`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold">{player}</span>
                <span className="font-bold text-lg">{gameState.scores[player]} pt</span>
              </div>
              <RatingDisplay playerName={player} />
            </div>
          ))}
        </div>

        {/* しりとり入力フォーム */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              className="flex-1 px-4 py-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!isMyTurn}
              placeholder={isMyTurn ? "単語を入力" : "相手のターンです..."}
            />
            <button
              type="submit"
              className={`px-4 py-2 rounded-r font-bold ${isMyTurn
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
              disabled={!isMyTurn}
            >
              送信
            </button>
          </div>
        </form>

        {/* しりとり履歴 */}
        <div className="mb-6">
          <h3 className="font-bold mb-2">しりとり履歴</h3>
          <div className="border rounded-lg p-4 bg-gray-50 min-h-[200px] max-h-[300px] overflow-y-auto">
            {gameState.history.length === 0 ? (
              <p className="text-gray-500 text-center">まだ単語がありません</p>
            ) : (
              <ul>
                {gameState.history.map((word, i) => {
                  const playerIndex = i % gameState.players.length;
                  return (
                    <li key={i} className="mb-1 flex">
                      <span className="font-bold mr-2">{gameState.players[playerIndex]}:</span>
                      <span>{word}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* 隠しルールのヒント */}
        <div>
          <h3 className="font-bold mb-2">ヒント</h3>
          <p className="text-gray-600 italic">
            このゲームには3つの隠しルールがあります。条件を満たす単語を言うとポイントが獲得できます。
          </p>
        </div>
      </div>
    </div>
  )
}

// ここから下はほぼ変更なし
function App() {
  const [roomCode, setRoomCode] = useState('0000')
  const [joined, setJoined] = useState(false)
  const [playerName, setPlayerName] = useState('')

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
    setRoomCode(value)
  }

  const handleNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value.slice(0, 10))
  }

  const handleJoin = () => {
    if (!playerName) {
      alert('プレイヤー名を入力してください')
      return
    }
    setJoined(true)
  }

  // シンプルなプレイヤーレート表示（ログイン画面に追加）
  const playerRating = playerName ? (
    <RatingDisplay playerName={playerName} />
  ) : null

  if (joined) {
    return <ShiritoriGame roomCode={roomCode} playerName={playerName} />
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-80">
        <h1 className="text-2xl font-bold mb-6 text-center">隠しルールしりとり</h1>
        <label className="block mb-2 text-gray-700">ルーム番号（4桁）</label>
        <input
          type="text"
          value={roomCode}
          onChange={handleInput}
          className="w-full px-4 py-2 border rounded mb-4 text-center text-xl"
          maxLength={4}
        />
        <label className="block mb-2 text-gray-700">プレイヤー名（10文字以内）</label>
        <input
          type="text"
          value={playerName}
          onChange={handleNameInput}
          className="w-full px-4 py-2 border rounded mb-4 text-center"
          maxLength={10}
        />
        {playerRating}
        <button
          onClick={handleJoin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded mt-4"
        >
          ルーム作成 / 参加
        </button>
      </div>
    </div>
  )
}

export default App
