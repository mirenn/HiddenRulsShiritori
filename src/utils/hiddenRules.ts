import type { HiddenRule } from '../types/game';

// サンプルの隠しルール定義
export const allHiddenRules: Omit<HiddenRule, 'achievedByPlayer' | 'checkFunction' | 'needsApi'>[] = [
  { id: 'rule1', description: '3文字の単語', points: 1 },
  { id: 'rule3', description: '食べ物の名前', points: 1 },
  { id: 'rule4', description: '動物の名前', points: 1 },
  { id: 'rule5', description: '色を表す単語', points: 1 },
  { id: 'rule6', description: 'ひらがな5文字以上の単語', points: 2 },
  { id: 'rule8', description: '「り」を含む単語', points: 1 },
  { id: 'rule9', description: '濁音もしくは半濁音を含む単語', points: 2 },
  { id: 'rule11', description: '植物の名前', points: 1 },
  { id: 'rule12', description: '乗り物の名前', points: 1 },
  { id: 'rule13', description: '同じ文字を2つ含む単語 (例: ばなな)', points: 2 },
  { id: 'rule14', description: '最初の文字と最後の文字が同じ単語', points: 2 },
  { id: 'rule15', description: '天候に関する言葉', points: 1 },
  { id: 'rule16', description: 'スポーツの名前', points: 1 },
  { id: 'rule19', description: '楽器の名前', points: 1 },
  { id: 'rule20', description: '丸い形を連想させる言葉', points: 1 },
  { id: 'rule21', description: '柔らかいものを表す言葉', points: 1 },
  { id: 'rule22', description: '甘いものを表す言葉', points: 1 },
  { id: 'rule23', description: '夏を連想させる言葉', points: 1 },
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
    case 'rule_n_ending': // 「ん」で終わる単語
      return word.endsWith('ん');
    case 'rule6': // ひらがな5文字以上の単語
      return word.length >= 5 && /^[ぁ-んー]+$/.test(word);
    case 'rule8': // 最後に「り」がつく言葉
      return word.endsWith('り');
    case 'rule9': // 「パ」から始まる単語
      return word.startsWith('パ');
    case 'rule3': // 食べ物の名前 - Gemini API候補
    case 'rule4': // 動物の名前 - Gemini API候補
    case 'rule5': // 色を表す単語 - Gemini API候補
    case 'rule11': // 植物の名前 - Gemini API候補
    case 'rule12': // 乗り物の名前 - Gemini API候補
    case 'rule15': // 天候に関する言葉 - Gemini API候補
    case 'rule16': // スポーツの名前 - Gemini API候補
    case 'rule19': // 楽器の名前 - Gemini API候補
    case 'rule20': // 丸い形を連想させる言葉 - Gemini API候補
    case 'rule21': // 柔らかいものを表す言葉 - Gemini API候補
    case 'rule22': // 甘いものを表す言葉 - Gemini API候補
    case 'rule23': // 夏を連想させる言葉 - Gemini API候補
      // Gemini APIが必要なルールはサーバーAPI経由
      return await callGeminiServerAPI(word, rule.id);
    default:
      return false;
  }
};
