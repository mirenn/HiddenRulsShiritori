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

  switch (rule.id) {
    case 'rule1': // 3文字の単語
      return word.length === 3;
    case 'rule2': // 「ん」で終わる単語
      return word.endsWith('ん');
    case 'rule3': // 食べ物の名前 - Gemini API候補
      // TODO: Gemini APIで判定 (例: 「[単語]は食べ物ですか？」)
      console.warn(`Rule '${rule.description}' needs Gemini API integration.`);
      return false; // 仮実装
    case 'rule4': // 動物の名前 - Gemini API候補
      // TODO: Gemini APIで判定
      console.warn(`Rule '${rule.description}' needs Gemini API integration.`);
      return false; // 仮実装
    case 'rule5': // 色を表す単語 - Gemini API候補
      // TODO: Gemini APIで判定
      console.warn(`Rule '${rule.description}' needs Gemini API integration.`);
      return false; // 仮実装
    case 'rule6': // ひらがな5文字以上の単語
      return word.length >= 5 && /^[ぁ-んー]+$/.test(word);
    case 'rule7': // カタカナの単語
      return /^[ァ-ヶー]+$/.test(word);
    case 'rule8': // 最後に「り」がつく言葉
      return word.endsWith('り');
    case 'rule9': // 「パ」から始まる単語
      return word.startsWith('パ');
    case 'rule10': // ことわざ (最初の3文字で判定) - Gemini API候補
      // TODO: Gemini APIで判定 (例: 「[単語]から始まることわざはありますか？」)
      console.warn(`Rule '${rule.description}' needs Gemini API integration.`);
      return false; // 仮実装
    default:
      return false;
  }
};
