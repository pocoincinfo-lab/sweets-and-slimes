import { RocketPhaseRequirement } from '../types/game';

export const ROCKET_PHASES: RocketPhaseRequirement[] = [
  {
    phase: 1,
    title: 'Phase 1: 基礎自動化とビスケット発射台整備',
    partName: 'ビスケット・ベース',
    description: 'まずは小麦と砂糖の採掘・焼成ラインを拡張し、基礎のビスケット発射台を固めよう！',
    requiredItems: {
      cookie: 20,
      sugar: 15,
      wheat: 15,
    },
    requiredStars: 3,
  },
  {
    phase: 2,
    title: 'Phase 2: 精錬ライン拡張とキャンディ基礎フレーム',
    partName: 'キャンディ・フレーム',
    description: 'オーブンとミキサーを増設して、ハードキャンディ板と生地・クリームを大量生産しよう！',
    requiredItems: {
      candy_glass: 80,
      flour_dough: 80,
      whipped_cream: 60,
      cookie: 80,
    },
    requiredStars: 25,
  },
  {
    phase: 3,
    title: 'Phase 3: 化学シロップ精製とウエハース耐熱壁',
    partName: 'シロップ・タンク',
    description: 'イチゴとカカオを運び込み、メープル燃料・耐熱チョコウエハース・特大プリンを精製しよう！',
    requiredItems: {
      syrup: 100,
      choco_wafer: 80,
      pudding: 70,
    },
    requiredStars: 45,
  },
  {
    phase: 4,
    title: 'Phase 4: パティスリー電子回路網の構築',
    partName: 'パティスリー回路網',
    description: 'パティスリー組立機群を並べて、タルト回路・タピオカ素子・耐熱ウエハースをライン生産！',
    requiredItems: {
      berry_tart: 100,
      tapioca_tea: 90,
      choco_wafer: 100,
    },
    requiredStars: 70,
  },
  {
    phase: 5,
    title: 'Phase 5: 超軽量キャンディ複合装甲の量産',
    partName: '複合装甲ハル',
    description: 'グランド製菓機を解禁し、大量のキャンディとウエハースを融合した複合装甲を組み立てよう！',
    requiredItems: {
      sugar_alloy_hull: 80,
      candy_glass: 120,
      choco_wafer: 100,
    },
    requiredStars: 100,
  },
  {
    phase: 6,
    title: 'Phase 6: 高圧縮パンケーキ推進燃料の充填',
    partName: 'パンケーキ・ブースター',
    description: 'プリンとメープル燃料を圧縮した10段ギガパンケーキ推進剤をロケットタンクへ満タンにしよう！',
    requiredItems: {
      pancake_tower: 90,
      pudding: 120,
      syrup: 150,
    },
    requiredStars: 140,
  },
  {
    phase: 7,
    title: 'Phase 7: マカロン誘導制御コンピュータの統合',
    partName: 'マカロン・コア',
    description: '精密な虹色マカロン演算基板とショートケーキ反応炉でロケットの頭脳を完成させよう！',
    requiredItems: {
      macaron_cpu: 90,
      shortcake: 80,
      tapioca_tea: 100,
    },
    requiredStars: 190,
  },
  {
    phase: 8,
    title: 'Phase 8: ロケットパーツ100基 ＆ 黄金パフェ衛星の最終組立！',
    partName: 'パフェ衛星・宇宙打ち上げ',
    description: '全生産ラインを総動員し、スター・ロケットパーツ100基と黄金パフェ宇宙衛星5基を納品して発射しよう！',
    requiredItems: {
      star_engine_core: 100,
      golden_parfait_satellite: 5,
      shortcake: 60,
    },
    requiredStars: 250,
  },
];
