import {
  BuildingInstance,
  BuildingType,
  Direction,
  GameState,
  ResourceNode,
  Tile,
} from '../types/game';

export const MAP_SIZE = 64;
export const SILO_MIN = 30;
export const SILO_MAX = 33; // 4x4 center: (30..33, 30..33)

let nextEntityId = 1;
export function genId(prefix: string): string {
  nextEntityId += 1;
  return `${prefix}_${nextEntityId}`;
}

export function dirDelta(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case 0:
      return { dx: 0, dy: -1 };
    case 1:
      return { dx: 1, dy: 0 };
    case 2:
      return { dx: 0, dy: 1 };
    case 3:
      return { dx: -1, dy: 0 };
  }
}

export function oppositeDir(dir: Direction): Direction {
  return ((dir + 2) % 4) as Direction;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function paintPatch(
  tiles: Tile[][],
  cx: number,
  cy: number,
  radius: number,
  resource: ResourceNode,
  rand: () => number
): void {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if (!inBounds(x, y)) continue;
      if (tiles[y][x].isRocketSilo) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2 + (rand() - 0.5) * 1.4) {
        tiles[y][x].resource = resource;
      }
    }
  }
}

export function createBuildingInstance(
  type: BuildingType,
  x: number,
  y: number,
  dir: Direction,
  selectedRecipeId: string | null = null
): BuildingInstance {
  return {
    id: genId('b'),
    type,
    x,
    y,
    dir,
    beltItems: [],
    splitterToggle: 0,
    inputBuffer: {},
    outputBuffer: [],
    craftProgress: 0,
    selectedRecipeId,
    activeRecipeId: selectedRecipeId,
    ammoBuffer: {},
    cooldown: 0,
    aimAngle: -Math.PI / 2,
    bounceAnim: 0,
    totalCrafted: 0,
  };
}

function placeInitialBuilding(
  state: GameState,
  type: BuildingType,
  x: number,
  y: number,
  dir: Direction,
  selectedRecipeId: string | null = null
): void {
  if (!inBounds(x, y)) return;
  const tile = state.tiles[y][x];
  if (tile.isRocketSilo || tile.buildingId) return;
  const b = createBuildingInstance(type, x, y, dir, selectedRecipeId);
  state.buildings[b.id] = b;
  tile.buildingId = b.id;
}

export function createInitialGameState(): GameState {
  const rand = seededRand(20261114);
  const tiles: Tile[][] = [];

  for (let y = 0; y < MAP_SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < MAP_SIZE; x++) {
      const isRocketSilo =
        x >= SILO_MIN && x <= SILO_MAX && y >= SILO_MIN && y <= SILO_MAX;
      row.push({
        x,
        y,
        resource: null,
        buildingId: null,
        isRocketSilo,
        decorSeed: rand(),
      });
    }
    tiles.push(row);
  }

  // Starter resource nodes around the central silo (guaranteed accessible & scenic)
  paintPatch(tiles, 22, 29, 2.3, 'wheat', rand);
  paintPatch(tiles, 22, 33, 2.3, 'sugar', rand);
  paintPatch(tiles, 28, 22, 2.5, 'milk', rand);
  paintPatch(tiles, 39, 25, 2.5, 'berry', rand);
  paintPatch(tiles, 39, 36, 2.5, 'cacao', rand);
  paintPatch(tiles, 30, 41, 2.4, 'sugar', rand);
  paintPatch(tiles, 34, 41, 2.4, 'wheat', rand);

  // Outer expansion patches
  const outerPatches: Array<{ cx: number; cy: number; r: number; res: ResourceNode }> = [
    { cx: 14, cy: 16, r: 3.1, res: 'wheat' },
    { cx: 49, cy: 15, r: 3.0, res: 'sugar' },
    { cx: 15, cy: 48, r: 3.0, res: 'berry' },
    { cx: 49, cy: 48, r: 3.1, res: 'cacao' },
    { cx: 48, cy: 31, r: 2.8, res: 'milk' },
    { cx: 14, cy: 31, r: 2.8, res: 'berry' },
    { cx: 32, cy: 12, r: 2.8, res: 'cacao' },
    { cx: 31, cy: 52, r: 2.8, res: 'milk' },
  ];
  for (const p of outerPatches) {
    paintPatch(tiles, p.cx, p.cy, p.r, p.res, rand);
  }

  // Guarantee exact nodes for starter factory
  tiles[30][23].resource = 'wheat';
  tiles[32][23].resource = 'sugar';
  tiles[34][24].resource = 'sugar';

  const state: GameState = {
    mapWidth: MAP_SIZE,
    mapHeight: MAP_SIZE,
    tiles,
    buildings: {},
    slimes: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    rocket: {
      phase: 1,
      delivered: {},
      launching: false,
      launchCountdown: 15,
      launchLiftY: 0,
      launched: false,
    },
    starSugar: 4,
    stats: {
      totalProduced: 0,
      totalDelivered: 0,
      slimesFed: 0,
      maxChain: 0,
      starsEarned: 4,
      playTimeSec: 0,
    },
    wave: {
      timer: 9,
      interval: 26,
      waveNumber: 0,
      nextSpawnEdge: 3, // West first so starter cannons immediately shine!
      activeRush: false,
    },
    peacefulMode: false,
    paused: false,
    muted: false,
    camera: {
      x: 29.5,
      y: 31.8,
      zoom: 44,
    },
    selectedTool: 'belt',
    buildDir: 1,
    inspectedBuildingId: null,
    productionHistory: [],
    unlockedModalDismissed: false,
    time: 0,
  };

  // Starter Bakery Line: Wheat + Sugar -> Oven (Cookie) -> Splitter -> Rocket Silo + 2 Cannons
  placeInitialBuilding(state, 'sugar_windmill', 21, 31, 0);
  placeInitialBuilding(state, 'sugar_windmill', 35, 31, 0);

  // Wheat line
  placeInitialBuilding(state, 'harvester', 23, 30, 1);
  placeInitialBuilding(state, 'belt', 24, 30, 1);
  placeInitialBuilding(state, 'belt', 25, 30, 2);

  // Sugar line -> Oven
  placeInitialBuilding(state, 'harvester', 23, 32, 1);
  placeInitialBuilding(state, 'belt', 24, 32, 1);
  placeInitialBuilding(state, 'belt', 25, 32, 0);

  // Oven baking cookies
  placeInitialBuilding(state, 'oven', 25, 31, 1, 'r_cookie');
  placeInitialBuilding(state, 'belt', 26, 31, 1);
  placeInitialBuilding(state, 'splitter', 27, 31, 1);

  // East branch -> Rocket Silo
  placeInitialBuilding(state, 'belt', 28, 31, 1);
  placeInitialBuilding(state, 'belt', 29, 31, 1);

  // North branch -> Upper Cookie Cannon
  placeInitialBuilding(state, 'belt', 27, 30, 0);
  placeInitialBuilding(state, 'belt', 27, 29, 0);
  placeInitialBuilding(state, 'cannon', 27, 28, 3);

  // South branch -> Lower Cookie Cannon
  placeInitialBuilding(state, 'belt', 27, 32, 2);
  placeInitialBuilding(state, 'belt', 27, 33, 2);
  placeInitialBuilding(state, 'cannon', 27, 34, 3);

  // Direct sugar line into Rocket Silo for Phase 1
  placeInitialBuilding(state, 'harvester', 24, 34, 1);
  placeInitialBuilding(state, 'belt', 25, 34, 1);
  placeInitialBuilding(state, 'belt', 26, 34, 1);
  placeInitialBuilding(state, 'belt', 27, 35, 1); // Wait: let's route around cannon at (27,34)
  // Adjust route neatly around (27,34) cannon:
  // Put harvester at (24,35) -> (25,35) -> (26,35) -> (27,35) -> (28,35) -> (29,35) -> (29,34) -> (29,33) -> (30,33 Silo)
  // Remove (24,34),(25,34),(26,34) and redo cleanly:
  for (const [rx, ry] of [
    [24, 34],
    [25, 34],
    [26, 34],
    [27, 35],
  ]) {
    const bid = state.tiles[ry][rx].buildingId;
    if (bid) {
      delete state.buildings[bid];
      state.tiles[ry][rx].buildingId = null;
    }
  }
  state.tiles[35][23].resource = 'sugar';
  placeInitialBuilding(state, 'harvester', 23, 35, 1);
  placeInitialBuilding(state, 'belt', 24, 35, 1);
  placeInitialBuilding(state, 'belt', 25, 35, 1);
  placeInitialBuilding(state, 'belt', 26, 35, 1);
  placeInitialBuilding(state, 'belt', 27, 35, 1);
  placeInitialBuilding(state, 'belt', 28, 35, 1);
  placeInitialBuilding(state, 'belt', 29, 35, 0);
  placeInitialBuilding(state, 'belt', 29, 34, 0);
  placeInitialBuilding(state, 'belt', 29, 33, 1);

  return state;
}
