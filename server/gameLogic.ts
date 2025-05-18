import { WebSocket } from 'ws';
import fetch from 'node-fetch';

// Gemini APIレスポンスの型定義
export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

// Gemini API 呼び出し関数
export const callGeminiAPIServer = async (prompt: string, apiKey?: string, gameState?: GameState): Promise<boolean> => {
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

    if (gameState) {
      if (!gameState.geminiInteractions) {
        gameState.geminiInteractions = [];
      }
      gameState.geminiInteractions.push({ prompt, response: resultText || 'Error or No Response' });
    }

    return resultText === 'はい' || resultText === 'yes';
  } catch (error) {
    console.error('Error calling Gemini API on server:', error);
    if (gameState) {
      if (!gameState.geminiInteractions) {
        gameState.geminiInteractions = [];
      }
      gameState.geminiInteractions.push({ prompt, response: `Error: ${error}` });
    }
    return false;
  }
};

// ルームの状態を保持するオブジェクト
export interface GameState {
  players: string[];
  history: string[];
  turn: number;
  hiddenRules: HiddenRule[]; // 実際の隠しルール (3つ)
  candidateHiddenRules: Omit<HiddenRule, 'checkFunction' | 'needsApi' | 'achievedByPlayer'>[]; // 候補となる隠しルール (9つ)
  scores: { [player: string]: number };
  winner: string | null;
  wordsSaidCount: { [player: string]: number }; // 各プレイヤーが言った単語数
  noPointTurns: number; // ポイント獲得なしの連続ターン数
  firstCharacter?: string;
  historyDetails?: {
    player: string;
    word: string;
    points: number;
    rulesAchieved: { id: string; description: string }[];
  }[];
  geminiInteractions?: { prompt: string; response: string }[]; // Gemini APIとのやり取り履歴
  gameOverReason?: string; // ゲーム終了理由
}

export interface HiddenRule {
  id: string;
  description: string;
  points: number;
  achievedByPlayer: string | null;
  checkFunction?: (word: string, previousWordOrApiKey?: string, gameState?: GameState) => Promise<boolean> | boolean;
  needsApi?: boolean;
}

// サーバーサイドの全ルールリスト
export const allServerRules: Omit<HiddenRule, 'achievedByPlayer'>[] = [
  { id: 'rule1', description: '3文字の単語', points: 1, checkFunction: (word) => word.length === 3 },
  { id: 'rule3', description: '食べ物の名前', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は食べ物の名前ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule4', description: '動物の名前', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は動物の名前ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule5', description: '色を表す単語', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は色を表す単語ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule6', description: 'ひらがな5文字以上の単語', points: 2, checkFunction: (word) => word.length >= 5 && /^[ぁ-んー]+$/.test(word) },
  { id: 'rule8', description: '「り」を含む単語', points: 1, checkFunction: (word) => word.includes('り') },
  { id: 'rule9', description: '濁音もしくは半濁音を含む単語', points: 1, checkFunction: (word) => /[\u3099\u309A]/.test(word) },
  { id: 'rule11', description: '植物の名前', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は植物の名前ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule12', description: '乗り物の名前', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は乗り物の名前ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule13', description: '同じ文字を2つ含む単語 (例:ばなな)', points: 2, checkFunction: (word) => /(\p{L}).*\1/u.test(word) },
  { id: 'rule14', description: '最初の文字と最後の文字が同じ単語', points: 2, checkFunction: (word) => word.length > 1 && word.charAt(0) === word.charAt(word.length - 1) },
  { id: 'rule15', description: '天候に関する言葉', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は天候に関する言葉ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule16', description: 'スポーツの名前', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」はスポーツの名前ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule19', description: '楽器の名前', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は楽器の名前ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule20', description: '丸い形を連想させる言葉', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は丸い形を連想させる言葉ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule21', description: '柔らかいものを表す言葉', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は柔らかいものを表す言葉ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule22', description: '甘いものを表す言葉', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は甘いものを表す言葉ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule23', description: '夏を連想させる言葉', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は夏を連想させる言葉ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule24', description: '前の単語と関連性の高い言葉', points: 2, needsApi: true, checkFunction: async (word, previousWord, gameState) => await callGeminiAPIServer(`「${word}」は「${previousWord}」と関連性の高い言葉ですか？ はい、いいえで答えてください。`, process.env.GEMINI_API_KEY, gameState) }, // APIキーの渡し方を修正
  { id: 'rule25', description: '前の単語より文字数が多い言葉', points: 2, checkFunction: (word, previousWord) => !!previousWord && word.length > previousWord.length },
  { id: 'rule26', description: '体の部位', points: 1, needsApi: true, checkFunction: async (word, apiKey, gameState) => await callGeminiAPIServer(`「${word}」は体の部位を表す言葉ですか？ はい、いいえで答えてください。`, apiKey, gameState) },
  { id: 'rule27', description: '伸ばし棒（長音）を含む単語', points: 1, checkFunction: (word) => word.includes('ー') },
];

// 隠しルールを生成する関数
export function generateHiddenRules(): HiddenRule[] {
  const shuffled = [...allServerRules].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3).map(rule => ({ ...rule, achievedByPlayer: null } as HiddenRule));
}

// 候補となる隠しルールを9つ生成する関数
export function generateCandidateHiddenRules(actualRules: HiddenRule[], allRules: Omit<HiddenRule, 'achievedByPlayer'>[]): Omit<HiddenRule, 'checkFunction' | 'needsApi' | 'achievedByPlayer'>[] {
  const actualRuleDescriptions = actualRules.map(r => r.description);
  const dummyRules = allRules
    .filter(rule => !actualRuleDescriptions.includes(rule.description))
    .sort(() => 0.5 - Math.random())
    .slice(0, 6)
    .map(({ id, description, points }) => ({ id, description, points }));

  const candidates = [...actualRules.map(({ id, description, points }) => ({ id, description, points })), ...dummyRules];
  return candidates.sort(() => 0.5 - Math.random());
}

// ダミーのルール説明を生成する関数 (ヒント用)
export function generateDummyRuleDescriptions(allRulesParam: Omit<HiddenRule, 'achievedByPlayer'>[], excludeRule: HiddenRule, count: number): string[] {
  const candidates = allRulesParam.filter(rule => rule.id !== excludeRule.id);
  const shuffled = [...candidates].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(rule => rule.description);
}

// ランダムなひらがなを生成する関数
export function getRandomHiragana(): string {
  const hiragana = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ".split("");
  return hiragana[Math.floor(Math.random() * hiragana.length)];
}

// 単語提出処理
export async function processPlayerWord(
    gameState: GameState,
    playerName: string,
    word: string,
    ws: WebSocket, // WebSocketオブジェクトを渡してエラーメッセージを直接送信
    geminiApiKey: string | undefined
): Promise<{
    pointsGainedThisTurn?: number;
    achievedRulesInfo?: { ruleId: string; description: string; points: number }[];
    gameOver?: boolean;
    winner?: string | null;
    reason?: string;
    hint?: { hintTargetRuleId: string; options: string[]; message: string };
    error?: string; // エラーメッセージを返すように変更
    geminiInteractions?: { prompt: string; response: string }[]; // ゲーム終了時に返す
}> {
    const previousWord = gameState.history.length > 0 ? gameState.history[gameState.history.length - 1] : undefined;

    // しりとりルールのチェック
    if (gameState.history.length > 0 && previousWord) {
        const lastChar = previousWord.endsWith('ー') ? previousWord.charAt(previousWord.length - 2) : previousWord.charAt(previousWord.length - 1);
        const firstChar = word.startsWith('ー') ? word.charAt(1) : word.charAt(0);
        if (firstChar.toLowerCase() !== lastChar.toLowerCase()) {
            ws.send(JSON.stringify({ type: 'error', message: '前の単語の最後の文字で始めてください' }));
            return { error: '前の単語の最後の文字で始めてください' };
        }
    } else if (gameState.firstCharacter && word.charAt(0) !== gameState.firstCharacter) {
        ws.send(JSON.stringify({ type: 'error', message: `最初の単語は「${gameState.firstCharacter}」から始めてください` }));
        return { error: `最初の単語は「${gameState.firstCharacter}」から始めてください` };
    }

    // 「ん」で終わるチェック
    const nEndingRule = gameState.hiddenRules.find(rule => rule.id === 'rule_n_ending');
    let isNEndingAllowedByRule = false;
    if (nEndingRule && nEndingRule.checkFunction) {
        if (nEndingRule.needsApi) {
            isNEndingAllowedByRule = await nEndingRule.checkFunction(word, geminiApiKey);
        } else {
            isNEndingAllowedByRule = nEndingRule.checkFunction(word) as boolean;
        }
    }

    if ((word.endsWith('ん') || word.endsWith('ン')) && !isNEndingAllowedByRule) {
        ws.send(JSON.stringify({ type: 'error', message: '「ん」で終わる単語は使えません (特別なルールがない限り)' }));
        return { error: '「ん」で終わる単語は使えません (特別なルールがない限り)' };
    }

    gameState.wordsSaidCount[playerName] = (gameState.wordsSaidCount[playerName] || 0) + 1;
    gameState.history.push(word);

    let pointsGainedThisTurn = 0;
    const achievedRulesInfo: { ruleId: string; description: string; points: number; }[] = [];
    for (const rule of gameState.hiddenRules) {
        let ruleCheckResult = false;
        if (rule.checkFunction) {
          if (rule.needsApi) {
            if (rule.id === 'rule24' && previousWord) { // 前の単語が必要なルール
              ruleCheckResult = await rule.checkFunction(word, previousWord, gameState);
            } else {
              ruleCheckResult = await rule.checkFunction(word, geminiApiKey, gameState);
            }
          } else if (rule.id === 'rule25' && previousWord) { // 前の単語が必要なルール
            ruleCheckResult = await rule.checkFunction(word, previousWord, gameState); // gameState を追加
          }
          else {
            ruleCheckResult = await rule.checkFunction(word, undefined, gameState); // gameState を追加、previousWordOrApiKey は undefined
          }
        }

        if (ruleCheckResult) {
            pointsGainedThisTurn += rule.points;
            achievedRulesInfo.push({ ruleId: rule.id, description: rule.description, points: rule.points });
        }
    }

    let hintInfo: { hintTargetRuleId: string; options: string[]; message: string } | undefined = undefined;

    if (pointsGainedThisTurn > 0) {
        gameState.scores[playerName] += pointsGainedThisTurn;
        gameState.noPointTurns = 0;
    } else {
        gameState.noPointTurns++;
        if (gameState.noPointTurns >= 2) {
            const unachievedRules = gameState.hiddenRules.filter(rule => rule.achievedByPlayer === null);
            if (unachievedRules.length > 0) {
                const hintRule = unachievedRules[Math.floor(Math.random() * unachievedRules.length)];
                const dummyRuleDescriptions = generateDummyRuleDescriptions(allServerRules, hintRule, 2); // allServerRulesを渡す
                const hintOptions = [hintRule.description, ...dummyRuleDescriptions].sort(() => 0.5 - Math.random());
                hintInfo = {
                    hintTargetRuleId: hintRule.id,
                    options: hintOptions,
                    message: `ヒント：隠し条件のうち一つは次のいずれかです： ${hintOptions.join('、')}`
                };
                gameState.noPointTurns = 0; // ヒントを出したらリセット
            }
        }
    }

    if (!gameState.historyDetails) gameState.historyDetails = [];
    gameState.historyDetails.push({
        player: playerName,
        word,
        points: pointsGainedThisTurn,
        rulesAchieved: achievedRulesInfo.map(r => ({ id: r.ruleId, description: r.description }))
    });

    if (gameState.scores[playerName] >= 5) {
      gameState.winner = playerName;
      gameState.gameOverReason = `${playerName}が5ポイント獲得しました！`;
      return { gameOver: true, winner: playerName, reason: gameState.gameOverReason, geminiInteractions: gameState.geminiInteractions };
    }

    const allPlayersSaid7Words = gameState.players.every(
        player => (gameState.wordsSaidCount[player] || 0) >= 7
    );

    if (allPlayersSaid7Words) {
      // スコアが最も高いプレイヤーを勝者とする
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
      gameState.winner = winners.join(', '); // 同点の場合は複数プレイヤー
      gameState.gameOverReason = '各プレイヤーが7単語言い終わりました。';
      return { gameOver: true, winner: gameState.winner, reason: gameState.gameOverReason, geminiInteractions: gameState.geminiInteractions };
    }

    gameState.turn = (gameState.turn + 1) % gameState.players.length;
    return { pointsGainedThisTurn, achievedRulesInfo, hint: hintInfo };
}
