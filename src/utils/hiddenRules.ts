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
  { id: 'rule24', description: '前の単語と関連性の高い言葉', points: 2 },
];

/**
 * ゲームごとにランダムな隠しルールを3つ選択します。
 */
export const selectHiddenRules = (): HiddenRule[] => {
  const shuffled = [...allHiddenRules].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3).map(rule => ({ ...rule, achievedByPlayer: null }));
};
