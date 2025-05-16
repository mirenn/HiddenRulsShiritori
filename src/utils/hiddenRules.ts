import { HiddenRule } from '../types/game';

// サンプルの隠しルール定義
const allHiddenRules: Omit<HiddenRule, 'achievedByPlayer'>[] = [
  { id: 'rule1', description: '3文字の単語', points: 1 },
  { id: 'rule2', description: '「ん」で終わる単語 (通常は反則)', points: 2 }, // しりとりゲームの前提を少し変えるルール
  { id: 'rule3', description: '食べ物の名前', points: 1 },
  { id: 'rule4', description: '動物の名前', points: 1 },
  { id: 'rule5', description: '色を表す単語', points: 1 },
  { id: 'rule6', description: 'ひらがな5文字以上の単語', points: 2 },
  { id: 'rule7', description: 'カタカナの単語', points: 1 },
  { id: 'rule8', description: '最後に「り」がつく言葉 (しりとりなので)', points: 1 },
  { id: 'rule9', description: '「パ」から始まる単語', points: 2 },
  { id: 'rule10', description: 'ことわざ (最初の3文字で判定)', points: 3 }, // Gemini API連携候補
];

/**
 * ゲームごとにランダムな隠しルールを3つ選択します。
 */
export const selectHiddenRules = (): HiddenRule[] => {
  const shuffled = [...allHiddenRules].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3).map(rule => ({ ...rule, achievedByPlayer: null }));
};

/**
 * 与えられた単語が特定の隠しルールに合致するかどうかを判定します。
 * @param word 判定する単語
 * @param rule 隠しルール
 * @returns 合致すればtrue、そうでなければfalse
 */
export const checkHiddenRule = async (word: string, rule: HiddenRule): Promise<boolean> => {
  // ここに各ルールの具体的な判定ロジックを実装します。
  // Gemini API を利用するルールは、API呼び出しを行う必要があります。
  // 簡単なルールは文字列操作で判定できます。

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  // TODO: 実際のGemini APIのエンドポイントに置き換えてください
  const geminiApiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  const callGeminiAPI = async (prompt: string): Promise<boolean> => {
    if (!apiKey) {
      console.error('Gemini API key is not set.');
      return false;
    }
    try {
      const response = await fetch(`${geminiApiEndpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
      if (!response.ok) {
        console.error('Gemini API request failed:', response.status, await response.text());
        return false;
      }
      const data = await response.json();
      // TODO: Gemini APIのレスポンス形式に合わせて、判定ロジックを調整してください。
      // ここでは、レスポンスのテキストが "はい" (またはそれに類する肯定的な回答) かどうかで判定する例を示します。
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
      return resultText === 'はい' || resultText === 'yes';
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return false;
    }
  };

  switch (rule.id) {
    case 'rule1': // 3文字の単語
      return word.length === 3;
    case 'rule2': // 「ん」で終わる単語
      return word.endsWith('ん');
    case 'rule3': // 食べ物の名前 - Gemini API候補
      return await callGeminiAPI(`「${word}」は食べ物の名前ですか？ はい、いいえで答えてください。`);
    case 'rule4': // 動物の名前 - Gemini API候補
      return await callGeminiAPI(`「${word}」は動物の名前ですか？ はい、いいえで答えてください。`);
    case 'rule5': // 色を表す単語 - Gemini API候補
      return await callGeminiAPI(`「${word}」は色を表す単語ですか？ はい、いいえで答えてください。`);
    case 'rule6': // ひらがな5文字以上の単語
      return word.length >= 5 && /^[ぁ-んー]+$/.test(word);
    case 'rule7': // カタカナの単語
      return /^[ァ-ヶー]+$/.test(word);
    case 'rule8': // 最後に「り」がつく言葉
      return word.endsWith('り');
    case 'rule9': // 「パ」から始まる単語
      return word.startsWith('パ');
    case 'rule10': // ことわざ (最初の3文字で判定) - Gemini API候補
      // ことわざの判定はより複雑なプロンプトやロジックが必要になる可能性があります。
      // ここでは簡略化のため、単語がことわざかどうかを直接尋ねる形にしています。
      return await callGeminiAPI(`「${word}」ということわざは存在しますか？ はい、いいえで答えてください。`);
    default:
      return false;
  }
};
