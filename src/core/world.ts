import {
  BuildingInstance,
  BuildingType,
  Direction,
  GameState,
  ResourceNode,
  Tile,
} from '../types/game';

export const MAP_SIZE = 80;
export const SILO_MIN = 38;
export const SILO_MAX = 41; // 4x4 center: (38..41, 38..41)
export const MAP_CENTER = 40;

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

function paintOrganicVein(
  tiles: Tile[][],
  nodes: Array<{ cx: number; cy: number; r: number }>,
  resource: ResourceNode,
  rand: () => number
): void {
  for (const n of nodes) {
    paintPatch(tiles, n.cx, n.cy, n.r, resource, rand);
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

  // 1. Starter West Outcrops just outside the spacious central factory plaza (x = 22..25)
  paintOrganicVein(
    tiles,
    [
      { cx: 22.8, cy: 36.2, r: 2.4 },
      { cx: 24.4, cy: 37.8, r: 1.9 },
    ],
    'wheat',
    rand
  );
  paintOrganicVein(
    tiles,
    [
      { cx: 22.6, cy: 42.6, r: 2.5 },
      { cx: 24.4, cy: 40.8, r: 1.9 },
    ],
    'sugar',
    rand
  );

  // 2. Mid-Ring Organic Veins (winding crescents, ribbons, twin ridges around the plaza)
  const midVeins: Array<{
    res: ResourceNode;
    nodes: Array<{ cx: number; cy: number; r: number }>;
  }> = [
    {
      res: 'milk',
      nodes: [
        { cx: 35, cy: 20, r: 2.8 },
        { cx: 39.5, cy: 18.5, r: 3.0 },
        { cx: 44, cy: 20, r: 2.7 },
      ],
    },
    {
      res: 'berry',
      nodes: [
        { cx: 58.5, cy: 34, r: 2.7 },
        { cx: 61, cy: 38.5, r: 3.1 },
        { cx: 59, cy: 43, r: 2.8 },
      ],
    },
    {
      res: 'cacao',
      nodes: [
        { cx: 36, cy: 59, r: 2.8 },
        { cx: 40.5, cy: 61, r: 3.1 },
        { cx: 45, cy: 58.5, r: 2.8 },
      ],
    },
    {
      res: 'sugar',
      nodes: [
        { cx: 21.5, cy: 23, r: 2.8 },
        { cx: 25.5, cy: 20.5, r: 2.6 },
      ],
    },
    {
      res: 'wheat',
      nodes: [
        { cx: 54.5, cy: 21.5, r: 2.8 },
        { cx: 58.5, cy: 24.5, r: 2.7 },
      ],
    },
    {
      res: 'berry',
      nodes: [
        { cx: 21.5, cy: 56, r: 2.9 },
        { cx: 25.5, cy: 59, r: 2.7 },
      ],
    },
    {
      res: 'milk',
      nodes: [
        { cx: 56, cy: 57, r: 2.9 },
        { cx: 60, cy: 54, r: 2.7 },
      ],
    },
  ];
  for (const v of midVeins) {
    paintOrganicVein(tiles, v.nodes, v.res, rand);
  }

  // 3. Outer Regional Mega-Continents (long exploration & belt logistics targets)
  const outerVeins: Array<{
    res: ResourceNode;
    nodes: Array<{ cx: number; cy: number; r: number }>;
  }> = [
    {
      res: 'wheat',
      nodes: [
        { cx: 10, cy: 13, r: 3.6 },
        { cx: 15, cy: 10, r: 3.8 },
        { cx: 20, cy: 12, r: 3.3 },
      ],
    },
    {
      res: 'cacao',
      nodes: [
        { cx: 9, cy: 29, r: 3.3 },
        { cx: 12, cy: 34, r: 3.2 },
      ],
    },
    {
      res: 'sugar',
      nodes: [
        { cx: 63, cy: 11, r: 3.6 },
        { cx: 68, cy: 14, r: 3.8 },
        { cx: 66, cy: 19, r: 3.3 },
      ],
    },
    {
      res: 'berry',
      nodes: [
        { cx: 48, cy: 9, r: 3.3 },
        { cx: 53, cy: 11, r: 3.2 },
      ],
    },
    {
      res: 'cacao',
      nodes: [
        { cx: 10, cy: 65, r: 3.6 },
        { cx: 15, cy: 69, r: 3.9 },
        { cx: 21, cy: 67, r: 3.4 },
      ],
    },
    {
      res: 'milk',
      nodes: [
        { cx: 9, cy: 49, r: 3.4 },
        { cx: 13, cy: 53, r: 3.2 },
      ],
    },
    {
      res: 'berry',
      nodes: [
        { cx: 64, cy: 68, r: 3.7 },
        { cx: 69, cy: 64, r: 3.8 },
        { cx: 67, cy: 59, r: 3.3 },
      ],
    },
    {
      res: 'wheat',
      nodes: [
        { cx: 49, cy: 70, r: 3.5 },
        { cx: 54, cy: 68, r: 3.3 },
      ],
    },
    {
      res: 'sugar',
      nodes: [
        { cx: 70, cy: 44, r: 3.4 },
        { cx: 68, cy: 49, r: 3.3 },
      ],
    },
  ];
  for (const v of outerVeins) {
    paintOrganicVein(tiles, v.nodes, v.res, rand);
  }

  // Keep a wide, clear Central Factory Plaza around the launchpad (26..54, 26..54)
  for (let y = 26; y <= 54; y++) {
    for (let x = 26; x <= 54; x++) {
      tiles[y][x].resource = null;
    }
  }

  // Guarantee exact nodes at the western plaza edge for starter cookie line
  tiles[38][25].resource = 'wheat';
  tiles[40][25].resource = 'sugar';
  tiles[43][25].resource = 'sugar';

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
    coins: 600,
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
    simSpeed: 1,
    camera: {
      x: 35.5,
      y: 39.5,
      zoom: 38,
    },
    selectedTool: 'belt',
    buildDir: 1,
    inspectedBuildingId: null,
    productionHistory: [],
    unlockedModalDismissed: false,
    time: 0,
  };

  // Starter Bakery Line: Wheat + Sugar (x=25) -> Oven (27,39) -> Splitter (29,39) -> Rocket Silo (38,39) + 2 Cannons
  placeInitialBuilding(state, 'sugar_windmill', 23, 39, 0);
  placeInitialBuilding(state, 'sugar_windmill', 43, 39, 0);

  // Wheat line -> Oven
  placeInitialBuilding(state, 'harvester', 25, 38, 1);
  placeInitialBuilding(state, 'belt', 26, 38, 1);
  placeInitialBuilding(state, 'belt', 27, 38, 2);

  // Sugar line -> Oven
  placeInitialBuilding(state, 'harvester', 25, 40, 1);
  placeInitialBuilding(state, 'belt', 26, 40, 1);
  placeInitialBuilding(state, 'belt', 27, 40, 0);

  // Oven baking cookies -> Splitter
  placeInitialBuilding(state, 'oven', 27, 39, 1, 'r_cookie');
  placeInitialBuilding(state, 'belt', 28, 39, 1);
  placeInitialBuilding(state, 'splitter', 29, 39, 1);

  // East branch -> Rocket Silo (x = 30..37, y = 39 -> 38,39)
  for (let bx = 30; bx <= 37; bx++) {
    placeInitialBuilding(state, 'belt', bx, 39, 1);
  }

  // North branch -> Upper Cookie Cannon
  placeInitialBuilding(state, 'belt', 29, 38, 0);
  placeInitialBuilding(state, 'belt', 29, 37, 0);
  placeInitialBuilding(state, 'cannon', 29, 36, 3);

  // South branch -> Lower Cookie Cannon
  placeInitialBuilding(state, 'belt', 29, 40, 2);
  placeInitialBuilding(state, 'belt', 29, 41, 2);
  placeInitialBuilding(state, 'cannon', 29, 42, 3);

  // Direct sugar belt across open plaza into Rocket Silo for Phase 1
  placeInitialBuilding(state, 'harvester', 25, 43, 1);
  for (let bx = 26; bx <= 36; bx++) {
    placeInitialBuilding(state, 'belt', bx, 43, 1);
  }
  placeInitialBuilding(state, 'belt', 37, 43, 0);
  placeInitialBuilding(state, 'belt', 37, 42, 0);
  placeInitialBuilding(state, 'belt', 37, 41, 1);

  return state;
}
