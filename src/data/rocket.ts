import { RocketPhaseRequirement } from '../types/game';

export const ROCKET_PHASES: RocketPhaseRequirement[] = [
  {
    phase: 1,
    title: 'Phase 1: ビスケット発射台基礎',
    partName: 'ビスケット・ベース',
    description: 'クッキーとシュガークリスタルをロケット発射台へ流し込み、土台を焼き固めよう！',
    requiredItems: {
      cookie: 12,
      sugar: 8,
    },
    requiredStars: 2,
  },
  {
    phase: 2,
    title: 'Phase 2: キャンディ装甲胴体',
    partName: 'キャンディ・ボディ',
    description: 'ハードキャンディ装甲とふわふわ生地でピカピカの胴体を組み立てよう！',
    requiredItems: {
      candy_glass: 12,
      flour_dough: 10,
    },
    requiredStars: 5,
  },
  {
    phase: 3,
    title: 'Phase 3: メープル推進ブースター',
    partName: 'メープル・ブースター',
    description: '高純度メープルシロップ燃料とチョコウエハース耐熱装甲で左右ブースターを増設！',
    requiredItems: {
      syrup: 10,
      choco_wafer: 10,
    },
    requiredStars: 8,
  },
  {
    phase: 4,
    title: 'Phase 4: ショートケーキ先端ポッド',
    partName: 'ショートケーキ・ノーズ',
    description: 'いちごタルトと特大いちごショートを載せて、夢の先端コックピットを完成させよう！',
    requiredItems: {
      berry_tart: 10,
      shortcake: 6,
    },
    requiredStars: 12,
  },
  {
    phase: 5,
    title: 'Phase 5: スターエンジン点火＆発射',
    partName: 'スター・ドライブ',
    description: '10段ギガパンケーキとキラキラ星エンジンコアを充填して、宇宙へ打ち上げよう！',
    requiredItems: {
      pancake_tower: 6,
      star_engine_core: 4,
    },
    requiredStars: 18,
  },
];
