import type { HiddenRule } from '../types/game';

// サンプルの隠しルール定義
const allHiddenRules: Omit<HiddenRule, 'achievedByPlayer'>[] = [
  { id: 'rule1', description: '3文字の単語', points: 1 },
  { id: 'rule2', description: '「ん」で終わる単語 (通常は反則)', points: 2 }, // しりとりゲームの前提を少し変えるルール
  { id: 'rule3', description: '食べ物の名前', points: 1 },
  { id: 'rule4', description: '動物の名前', points: 1 },
  { id: 'rule5', description: '色を表す単語', points: 1 },
  { id: 'rule6', description: 'ひらがな5文字以上の単語', points: 2 },
  { id: 'rule7', description: 'ひらがなの単語', points: 1 },
  { id: 'rule8', description: '最後に「り」がつく言葉 (しりとりなので)', points: 1 },
  { id: 'rule9', description: '「ぱ」から始まる単語', points: 2 },
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
// Gemini APIが必要なルールはサーバーAPI経由で判定
const callGeminiServerAPI = async (word: string, ruleId: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/check-hidden-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, ruleId })
    });
    if (!response.ok) return false;
    const data = await response.json();
    return !!data.result;
  } catch (e) {
    console.error('サーバーAPI呼び出し失敗', e);
    return false;
  }
};

export const checkHiddenRule = async (word: string, rule: HiddenRule): Promise<boolean> => {
  switch (rule.id) {
    case 'rule1': // 3文字の単語
      return word.length === 3;
    case 'rule2': // 「ん」で終わる単語
      return word.endsWith('ん');
    case 'rule6': // ひらがな5文字以上の単語
      return word.length >= 5 && /^[ぁ-んー]+$/.test(word);
    case 'rule7': // ひらがなの単語
      return /^[ぁ-んー]+$/.test(word);
    case 'rule8': // 最後に「り」がつく言葉
      return word.endsWith('り');
    case 'rule9': // 「パ」から始まる単語
      return word.startsWith('パ');
    case 'rule3': // 食べ物の名前 - Gemini API候補
    case 'rule4': // 動物の名前 - Gemini API候補
    case 'rule5': // 色を表す単語 - Gemini API候補
      // Gemini APIが必要なルールはサーバーAPI経由
      return await callGeminiServerAPI(word, rule.id);
    default:
      return false;
  }
};
