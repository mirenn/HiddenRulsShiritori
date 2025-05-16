import { useState, useEffect } from 'react'

function ShiritoriGame({ roomCode, playerName }: { roomCode: string; playerName: string }) {
  // ルーム状態管理: localStorageで2人分のプレイヤー情報を管理
  const roomKey = `shiritori-room-${roomCode}`
  const [players, setPlayers] = useState<string[]>([])
  const [isReady, setIsReady] = useState(false)

  // しりとり履歴・ターン管理
  const gameKey = `shiritori-game-${roomCode}`
  const [history, setHistory] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [turn, setTurn] = useState(0) // 0: 先手, 1: 後手
  const myIndex = players.indexOf(playerName)

  // ルーム状態をlocalStorageから取得
  useEffect(() => {
    const stored = localStorage.getItem(roomKey)
    let playerList: string[] = []
    if (stored) {
      try {
        playerList = JSON.parse(stored)
      } catch {}
    }
    // まだ自分が入っていなければ追加
    if (!playerList.includes(playerName)) {
      playerList.push(playerName)
      localStorage.setItem(roomKey, JSON.stringify(playerList))
    }
    setPlayers(playerList)
  }, [roomKey, playerName])

  // 他のプレイヤーの参加をポーリングで監視
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem(roomKey)
      if (stored) {
        const playerList = JSON.parse(stored)
        setPlayers(playerList)
        if (playerList.length === 2) setIsReady(true)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [roomKey])

  // ゲーム状態をlocalStorageから取得
  useEffect(() => {
    const stored = localStorage.getItem(gameKey)
    if (stored) {
      try {
        const { history, turn } = JSON.parse(stored)
        setHistory(history)
        setTurn(turn)
      } catch {}
    }
  }, [gameKey, isReady])

  // 履歴・ターンをポーリングで同期
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem(gameKey)
      if (stored) {
        try {
          const { history, turn } = JSON.parse(stored)
          setHistory(history)
          setTurn(turn)
        } catch {}
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [gameKey])

  // 単語入力処理
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input) return
    // しりとりルール: 前の単語の最後の文字で始まるか
    if (history.length > 0) {
      const prev = history[history.length - 1]
      if (input[0] !== prev[prev.length - 1]) {
        alert('前の単語の最後の文字で始めてください')
        return
      }
    }
    // 自分のターンか
    if (turn !== myIndex) {
      alert('相手のターンです')
      return
    }
    const newHistory = [...history, input]
    const nextTurn = (turn + 1) % 2
    localStorage.setItem(gameKey, JSON.stringify({ history: newHistory, turn: nextTurn }))
    setHistory(newHistory)
    setTurn(nextTurn)
    setInput('')
  }

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-50">
        <div className="bg-white p-8 rounded shadow-md w-96">
          <h2 className="text-xl font-bold mb-4">ルーム: {roomCode}</h2>
          <p className="mb-2">プレイヤー名: {playerName}</p>
          <p className="mb-4">待機中...（もう1人の参加を待っています）</p>
          <ul className="mb-2">
            {players.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-50">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-xl font-bold mb-4">ルーム: {roomCode}</h2>
        <p className="mb-2">参加者: {players.join(', ')}</p>
        <p className="mb-2">あなた: {playerName}（{myIndex === 0 ? '先手' : '後手'}）</p>
        <p className="mb-4 font-bold">{turn === myIndex ? 'あなたのターンです' : '相手のターンです'}</p>
        <form onSubmit={handleSubmit} className="flex mb-4">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            className="flex-1 px-2 py-1 border rounded mr-2"
            disabled={turn !== myIndex}
            placeholder="単語を入力"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 py-1 rounded"
            disabled={turn !== myIndex}
          >
            送信
          </button>
        </form>
        <div className="mb-2">しりとり履歴:</div>
        <ul className="mb-2 border rounded p-2 min-h-[48px] bg-gray-50">
          {history.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

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
        <button
          onClick={handleJoin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          ルーム作成 / 参加
        </button>
      </div>
    </div>
  )
}

export default App
