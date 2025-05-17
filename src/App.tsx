import { useState, useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import RatingDisplay from './components/RatingDisplay'

function ShiritoriGame({ roomCode, playerName }: { roomCode: string; playerName: string }) {
  const [input, setInput] = useState('')
  const [showGameSummary, setShowGameSummary] = useState(false)
  
  // WebSocket接続とゲーム状態管理
  const { 
    gameState, 
    error, 
    isConnected, 
    sendWord,
    lastPointsGained,
    hintMessage // hintMessage をフックから取得
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md mx-auto transition-all duration-300 transform hover:scale-[1.01]">
          <h2 className="text-2xl font-bold mb-4 text-center text-indigo-700">ルーム: {roomCode}</h2>
          <p className="mb-2 text-center">プレイヤー名: {playerName}</p>
          <p className="mb-6 text-center text-gray-600">
            {error || "サーバーに接続中..."}
          </p>
          <div className="animate-pulse flex justify-center">
            <div className="h-4 w-4 bg-indigo-600 rounded-full mx-1"></div>
            <div className="h-4 w-4 bg-indigo-600 rounded-full mx-1 animate-delay-200"></div>
            <div className="h-4 w-4 bg-indigo-600 rounded-full mx-1 animate-delay-400"></div>
          </div>
        </div>
      </div>
    )
  }

  // プレイヤーが1人しかいない場合の表示
  if (gameState.players.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md mx-auto transition-all duration-300">
          <h2 className="text-2xl font-bold mb-4 text-center text-indigo-700">ルーム: {roomCode}</h2>
          <p className="mb-2 text-center">プレイヤー名: {playerName}</p>
          <p className="mb-6 text-center text-gray-600">待機中...（もう1人の参加を待っています）</p>
          <div className="flex justify-center mb-4">
            <RatingDisplay playerName={playerName} />
          </div>
          <div className="mt-4 bg-gray-50 p-4 rounded-lg">
            <p className="font-medium text-center mb-2">参加者:</p>
            <ul className="mb-2 space-y-2">
              {gameState.players.map((p) => (
                <li key={p} className="flex justify-between items-center px-4 py-2 bg-white rounded-lg shadow-sm">
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
    let gameEndReasonMessage = '';
    if (gameState?.gameOverReason === 'allPlayersSaid10Words') {
      gameEndReasonMessage = '各プレイヤーが10単語言い終わったため、ゲーム終了です。';
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-lg mx-auto transition-all duration-300">
          <h2 className="text-2xl font-bold mb-4 text-center text-indigo-700">ゲーム終了</h2>
          {gameEndReasonMessage && (
            <p className="text-center mb-2 text-gray-600">{gameEndReasonMessage}</p>
          )}
          <p className="text-center mb-6 text-2xl font-bold text-gray-800">
            {gameState.winner === 'draw' ? '引き分けです！' : 
             gameState.winner === playerName ? '🎉 勝利しました！ 🎉' : '😔 敗北しました... 😔'}
          </p>
          
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold mb-3 text-center text-indigo-600">隠しルール一覧</h3>
            <ul className="list-disc pl-5 space-y-1">
              {gameState.hiddenRules.map((rule, i) => (
                <li key={i} className="text-gray-700">{rule.description}</li>
              ))}
            </ul>
          </div>
          
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold mb-3 text-center text-indigo-600">最終スコア</h3>
            <div className="space-y-2">
              {gameState.players.map(player => (
                <div key={player} className="flex justify-between items-center px-4 py-2 bg-white rounded-lg shadow-sm">
                  <span className={`${player === gameState.winner ? 'font-bold text-indigo-700' : 'text-gray-700'}`}>
                    {player} {player === gameState.winner && '👑'}
                  </span>
                  <span className="font-semibold">{gameState.scores[player]}ポイント</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold mb-3 text-center text-indigo-600">レーティング変動</h3>
            <div className="space-y-2">
              {gameState.players.map(player => (
                <div key={player} className="flex justify-between items-center px-4 py-2 bg-white rounded-lg shadow-sm">
                  <span className="text-gray-700">{player}</span>
                  <RatingDisplay 
                    playerName={player} 
                    showChange={true} 
                    ratingChange={player === gameState.winner ? 20 : -20}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold mb-3 text-center text-indigo-600">しりとり履歴</h3>
            <div className="border rounded-lg p-4 bg-white min-h-[200px] max-h-[300px] overflow-y-auto shadow-inner">
              {gameState.history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">まだ単語がありません</p>
              ) : (
                <ul className="space-y-2">
                  {gameState.history.slice().reverse().map((word, i) => {
                    // Note: index `i` here is from the reversed array.
                    // If you need the original index, you might need to adjust logic or pass it differently.
                    // For player assignment, we need to be careful.
                    // Original logic: const playerIndex = i % gameState.players.length;
                    // With reverse, if history length is H, original index is H - 1 - i.
                    const originalIndex = gameState.history.length - 1 - i;
                    const playerIndex = originalIndex % gameState.players.length;
                    const player = gameState.players[playerIndex];
                    // 詳細情報があれば取得
                    const detail = gameState.historyDetails?.[originalIndex];
                    return (
                      <li key={originalIndex} className={`px-3 py-2 rounded-lg bg-gray-50 shadow-sm`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold mr-2 text-indigo-700">{player}:</span>
                          <span className="text-gray-800">{word}</span>
                          {detail && detail.points > 0 && (
                            <span className="ml-2 text-yellow-700 font-semibold">+{detail.points}pt</span>
                          )}
                        </div>
                        {detail && detail.rulesAchieved && detail.rulesAchieved.length > 0 && (
                          <div className="text-xs text-gray-600 mt-1 pl-6">
                            達成ルール: {detail.rulesAchieved.map((r: any) => r.description).join(', ')}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            新しいゲームを始める
          </button>
        </div>
      </div>
    )
  }

  // ゲーム進行中の表示
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 p-4">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-2xl mx-auto">
        {/* ヘッダー部分 */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <div className="mb-2 sm:mb-0">
            <h2 className="text-xl font-bold text-indigo-700">ルーム: {roomCode}</h2>
          </div>
          <div className="text-center sm:text-right">
            <p className={`font-bold text-lg ${isMyTurn ? 'text-green-600' : 'text-gray-600'} px-4 py-1 rounded-full ${isMyTurn ? 'bg-green-100' : 'bg-gray-100'}`}>
              {isMyTurn ? 'あなたのターン' : '相手のターン'}
            </p>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded mb-4 shadow-sm">
            <div className="flex">
              <div className="py-1"><svg className="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/></svg></div>
              <div>{error}</div>
            </div>
          </div>
        )}
        
        {/* ポイント獲得通知 */}
        {lastPointsGained && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 px-4 py-3 rounded mb-4 animate-pulse shadow-sm">
            <div className="flex items-center">
              <strong>{lastPointsGained.player}</strong>が条件を満たして<strong> {lastPointsGained.points}ポイント </strong>獲得しました！
            </div>
          </div>
        )}

        {/* ヒント表示 */}
        {hintMessage && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 px-4 py-3 rounded mb-4 shadow-sm">
            <div className="flex">
              <div className="py-1"><svg className="fill-current h-6 w-6 text-blue-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 20a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-9a1 1 0 0 1 1-1h.01a1 1 0 0 1 0 2H10a1 1 0 0 1-1-1zm0-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg></div>
              <div>
                <p className="font-bold">ヒント！</p>
                <p className="text-sm">{hintMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* プレイヤー情報 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {gameState.players.map((player, index) => (
            <div 
              key={player} 
              className={`p-4 rounded-lg transition-all duration-200 ${player === playerName ? 'bg-blue-100' : 'bg-gray-100'} 
                         ${gameState.turn === index ? 'border-2 border-green-500 shadow-md' : 'border border-transparent'}`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800">{player}</span>
                <span className="font-bold text-lg bg-white px-3 py-1 rounded-full shadow-sm text-indigo-700">{gameState.scores[player]} pt</span>
              </div>
              <div className="mt-1 text-sm text-gray-600">
                言った単語数: {gameState.wordsSaidCount?.[player] || 0} / 10
              </div>
              <div className="mt-2">
                <RatingDisplay playerName={player} />
              </div>
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
              className={`flex-1 px-4 py-3 border rounded-l-lg focus:outline-none focus:ring-2 ${isMyTurn ? 'focus:ring-indigo-500 border-gray-300' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
              disabled={!isMyTurn}
              placeholder={isMyTurn ? "ひらがなで単語を入力" : "相手のターンです..."}
            />
            <button
              type="submit"
              className={`px-6 py-3 rounded-r-lg font-bold transition-colors duration-200 ${isMyTurn
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' 
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
              disabled={!isMyTurn}
            >
              送信
            </button>
          </div>
        </form>

        {/* しりとり履歴 */}
        <div className="mb-6">
          <h3 className="font-bold mb-3 text-gray-700 pl-2 border-l-4 border-indigo-500">しりとり履歴</h3>
          <div className="border rounded-lg p-4 bg-gray-50 min-h-[200px] max-h-[300px] overflow-y-auto shadow-inner">
            {gameState.history.length === 0 ? (
              <p className="text-gray-500 text-center py-8">まだ単語がありません</p>
            ) : (
              <ul className="space-y-2">
                {gameState.history.slice().reverse().map((word, i) => {
                  // Note: index `i` here is from the reversed array.
                  // Original logic: const playerIndex = i % gameState.players.length;
                  // With reverse, if history length is H, original index is H - 1 - i.
                  const originalIndex = gameState.history.length - 1 - i;
                  const playerIndex = originalIndex % gameState.players.length;
                  const isCurrentPlayer = gameState.players[playerIndex] === playerName;
                  return (
                    <li key={originalIndex} className={`px-3 py-2 rounded-lg ${isCurrentPlayer ? 'bg-blue-50 text-blue-800' : 'bg-white text-gray-800'} shadow-sm`}>
                      <span className={`font-bold mr-2 ${isCurrentPlayer ? 'text-blue-700' : 'text-gray-700'}`}>{gameState.players[playerIndex]}:</span>
                      <span>{word}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* 隠しルールのヒント */}
        <div className="bg-indigo-50 p-4 rounded-lg shadow-sm">
          <h3 className="font-bold mb-2 text-indigo-700">ヒント</h3>
          <p className="text-gray-700 italic">
            このゲームには3つの隠しルールがあります。条件を満たす単語を言うとポイントが獲得できます。
          </p>
        </div>

        {/* 隠しルールのヒント (これは固定表示なので、動的なヒントとは別) */}
        <div className="bg-indigo-50 p-4 rounded-lg shadow-sm mt-6">
          <h3 className="font-bold mb-2 text-indigo-700">隠しルールについて</h3>
          <p className="text-gray-700 italic">
            このゲームには3つの隠しルールがあります。条件を満たす単語を言うとポイントが獲得できます。
            4ターン連続で誰もポイントを獲得できない場合、隠しルールのうち1つに関するヒントが表示されます。
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
  const [nameError, setNameError] = useState('')

  // Load player name from localStorage on initial render
  useEffect(() => {
    const storedPlayerName = localStorage.getItem('playerName');
    if (storedPlayerName) {
      setPlayerName(storedPlayerName);
    }
  }, []);

  // Save player name to localStorage whenever it changes
  useEffect(() => {
    if (playerName) {
      localStorage.setItem('playerName', playerName);
    }
  }, [playerName]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
    setRoomCode(value)
  }

  const handleNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value.slice(0, 10))
    if (e.target.value) {
      setNameError('')
    }
  }

  const handleJoin = () => {
    if (!playerName) {
      setNameError('プレイヤー名は必須です')
      return
    }
    setJoined(true)
  }

  // シンプルなプレイヤーレート表示（ログイン画面に追加）
  // const playerRating = playerName ? (
  // <RatingDisplay playerName={playerName} />
  // ) : null

  if (joined) {
    return <ShiritoriGame roomCode={roomCode} playerName={playerName} />
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 px-2">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg mx-auto transition-all duration-300 flex flex-col items-start border-4 border-indigo-600">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-8 text-left text-indigo-700 tracking-tight  w-full">
          <span className="text-black">
            隠しルールしりとり
          </span>
          <br />
          <span className="text-base text-indigo-400 font-medium mt-2 tracking-wide block text-left">みんなで推理しながら遊ぼう！</span>
        </h1>
        
        <div className="space-y-6 w-full">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-gray-700 font-semibold text-lg">ルーム番号（4桁）</label>
              <div className="relative group">
                <button 
                  className="text-sm text-indigo-600 hover:text-indigo-800 flex items-left"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </button>
                <div 
                  className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-gray-800 text-white text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none group-hover:pointer-events-auto"
                  role="tooltip"
                >
                  <p className="mb-2">友達と遊ぶ場合は、同じ4桁の数字を入力して参加してください。</p>
                  <p className="mb-2">部屋が存在しない場合は新しい部屋が作成されます。</p>
                  {playerName && (
                    <div className="my-2">
                      <p className="font-semibold">あなたの現在のレート:</p>
                      <RatingDisplay playerName={playerName} />
                    </div>
                  )}
                  <a 
                    href="https://github.com/mirenn/HiddenRulsShiritori#readme"
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    詳しい説明はこちら (GitHub)
                  </a>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-gray-800"></div>
                </div>
              </div>
            </div>
            <input
              type="text"
              value={roomCode}
              onChange={handleInput}
              className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-2xl bg-indigo-50 transition-all"
              maxLength={4}
            />
          </div>
          
          <div>
            <label className="block text-gray-700 font-semibold text-lg">プレイヤー名（10文字以内）</label>
            <input
              type="text"
              value={playerName}
              onChange={handleNameInput}
              className="w-full mb-8 px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg bg-indigo-50 transition-all"
              maxLength={10}
              placeholder="必須"
            />
            {nameError && <p className="text-red-500 text-sm mt-1">{nameError}</p>}
          </div>
          
          {/* <div className="flex justify-center mt-2 mb-8">
            {playerRating}
          </div> */}
          
          <button
            onClick={handleJoin}
            disabled={!playerName}
            className={`w-full font-bold py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl text-lg tracking-wide ${
              playerName
                ? 'bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            ルーム作成 / 参加
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
