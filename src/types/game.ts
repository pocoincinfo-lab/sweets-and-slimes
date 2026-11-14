export type ItemId =
  | 'wheat'
  | 'sugar'
  | 'berry'
  | 'milk'
  | 'cacao'
  | 'flour_dough'
  | 'candy_glass'
  | 'whipped_cream'
  | 'syrup'
  | 'cookie'
  | 'berry_tart'
  | 'choco_wafer'
  | 'pudding'
  | 'tapioca_tea'
  | 'shortcake'
  | 'pancake_tower'
  | 'star_engine_core'
  | 'sugar_alloy_hull'
  | 'macaron_cpu'
  | 'golden_parfait_satellite';

export type ItemCategory = 'raw' | 'tier1' | 'tier2' | 'tier3' | 'tier4';

export type SpecialEffect =
  | 'none'
  | 'slow'
  | 'splash'
  | 'knockback'
  | 'stun'
  | 'mega_splash'
  | 'rapid';

export interface ItemDef {
  id: ItemId;
  name: string;
  shortName: string;
  category: ItemCategory;
  description: string;
  color: string;
  accentColor: string;
  calories: number;
  specialEffect: SpecialEffect;
  effectLabel: string;
  rocketValue: number;
}

export type BuildingType =
  | 'belt'
  | 'express_belt'
  | 'splitter'
  | 'tunnel'
  | 'harvester'
  | 'oven'
  | 'mixer'
  | 'patisserie'
  | 'confectioner'
  | 'cannon'
  | 'gatling_cannon'
  | 'sugar_windmill';

export type BuildingCategory = 'logistics' | 'production' | 'defense' | 'power';

export interface BuildingDef {
  type: BuildingType;
  name: string;
  shortName: string;
  category: BuildingCategory;
  description: string;
  costCoins: number;
  powerDemand: number;
  powerSupply: number;
  craftSpeed: number;
  hotkey: string;
  accentColor: string;
  unlockPhase: number;
}

export type Direction = 0 | 1 | 2 | 3; // 0: North, 1: East, 2: South, 3: West

export type ResourceNode = 'wheat' | 'sugar' | 'berry' | 'milk' | 'cacao';

export interface Recipe {
  id: string;
  name: string;
  machine: 'oven' | 'mixer' | 'patisserie' | 'confectioner';
  inputs: Partial<Record<ItemId, number>>;
  output: ItemId;
  outputCount: number;
  durationSec: number;
}

export interface Tile {
  x: number;
  y: number;
  resource: ResourceNode | null;
  buildingId: string | null;
  isRocketSilo: boolean;
  decorSeed: number;
}

export interface BeltItem {
  id: string;
  itemId: ItemId;
  progress: number; // 0..1 across tile
  fromDir: Direction;
}

export interface BuildingInstance {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  dir: Direction;
  beltItems: BeltItem[];
  splitterToggle: number;
  inputBuffer: Partial<Record<ItemId, number>>;
  outputBuffer: ItemId[];
  craftProgress: number;
  selectedRecipeId: string | null;
  activeRecipeId: string | null;
  ammoBuffer: Partial<Record<ItemId, number>>;
  cooldown: number;
  aimAngle: number;
  bounceAnim: number;
  totalCrafted: number;
}

export type SlimeType =
  | 'pink_slime'
  | 'choco_slime'
  | 'pudding_slime'
  | 'king_slime';

export interface SlimeDef {
  type: SlimeType;
  name: string;
  description: string;
  color: string;
  bellyColor: string;
  baseRadius: number;
  maxFed: number;
  speed: number;
  starReward: number;
}

export interface Slime {
  id: string;
  type: SlimeType;
  x: number; // world tile units (e.g. 32.5)
  y: number;
  vx: number;
  vy: number;
  fed: number;
  maxFed: number;
  state: 'approaching' | 'bouncing' | 'riding_belt';
  slowTimer: number;
  stunTimer: number;
  wobblePhase: number;
  chainCount: number;
  squash: number;
  originDirX: number;
  originDirY: number;
  ridingTimer: number;
}

export interface Projectile {
  id: string;
  itemId: ItemId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetId: string;
  speed: number;
  angle: number;
  spin: number;
  calories: number;
  specialEffect: SpecialEffect;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'star' | 'heart' | 'crumb' | 'puff' | 'cotton' | 'ring';
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface RocketPhaseRequirement {
  phase: number;
  title: string;
  partName: string;
  description: string;
  requiredItems: Partial<Record<ItemId, number>>;
  requiredStars: number;
}

export interface RocketState {
  phase: number; // 1..8, launching/launched handles completion
  delivered: Partial<Record<ItemId, number>>;
  launching: boolean;
  launchCountdown: number;
  launchLiftY: number;
  launched: boolean;
}

export interface GameStats {
  totalProduced: number;
  totalDelivered: number;
  slimesFed: number;
  maxChain: number;
  starsEarned: number;
  playTimeSec: number;
}

export interface CameraState {
  x: number; // center world tile X
  y: number; // center world tile Y
  zoom: number; // pixels per tile
}

export interface WaveState {
  timer: number;
  interval: number;
  waveNumber: number;
  nextSpawnEdge: Direction;
  activeRush: boolean;
}

export interface GameState {
  mapWidth: number;
  mapHeight: number;
  tiles: Tile[][];
  buildings: Record<string, BuildingInstance>;
  slimes: Slime[];
  projectiles: Projectile[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  rocket: RocketState;
  coins: number;
  starSugar: number;
  stats: GameStats;
  wave: WaveState;
  peacefulMode: boolean;
  paused: boolean;
  muted: boolean;
  simSpeed: 1 | 2 | 5;
  camera: CameraState;
  selectedTool: BuildingType | 'demolish' | 'inspect';
  buildDir: Direction;
  inspectedBuildingId: string | null;
  productionHistory: number[]; // timestamps of recent productions for items/min
  unlockedModalDismissed: boolean;
  time: number;
}
