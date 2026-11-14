import { BUILDINGS } from '../data/buildings';
import { ITEMS, SLIME_DEFS } from '../data/items';
import { RECIPES, RECIPES_BY_MACHINE } from '../data/recipes';
import { ROCKET_PHASES } from '../data/rocket';
import {
  BuildingInstance,
  BuildingType,
  Direction,
  GameState,
  ItemId,
  Projectile,
  Recipe,
  Slime,
  SlimeType,
} from '../types/game';
import { audio } from './audio';
import {
  createBuildingInstance,
  dirDelta,
  genId,
  inBounds,
  MAP_SIZE,
  oppositeDir,
  SILO_MAX,
  SILO_MIN,
} from './world';

export interface PowerStats {
  supply: number;
  demand: number;
  ratio: number;
}

export function computePowerStats(state: GameState): PowerStats {
  let supply = 10; // Base emergency core power
  let demand = 0;
  for (const b of Object.values(state.buildings)) {
    const def = BUILDINGS[b.type];
    supply += def.powerSupply;
    demand += def.powerDemand;
  }
  const ratio = demand <= 0 ? 1 : Math.min(1, Math.max(0.35, supply / demand));
  return { supply, demand, ratio };
}

export function getRecipeById(id: string | null): Recipe | undefined {
  if (!id) return undefined;
  return RECIPES.find((r) => r.id === id);
}

export function getItemsPerMinute(state: GameState): number {
  const cutoff = state.time - 30;
  let count = 0;
  for (let i = state.productionHistory.length - 1; i >= 0; i--) {
    if (state.productionHistory[i] >= cutoff) {
      count += 1;
    } else {
      break;
    }
  }
  return count * 2;
}

export function spawnParticle(
  state: GameState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  color: string,
  kind: GameState['particles'][number]['kind'],
  size = 0.16,
  maxLife = 0.7
): void {
  if (state.particles.length > 420) return;
  state.particles.push({
    x,
    y,
    vx,
    vy,
    life: maxLife,
    maxLife,
    size,
    color,
    kind,
  });
}

export function addFloatingText(
  state: GameState,
  x: number,
  y: number,
  text: string,
  color: string,
  scale = 1
): void {
  if (state.floatingTexts.length > 60) {
    state.floatingTexts.shift();
  }
  state.floatingTexts.push({
    x,
    y,
    vy: -0.95,
    text,
    color,
    life: 1.15,
    maxLife: 1.15,
    scale,
  });
}

export function placeBuilding(
  state: GameState,
  type: BuildingType,
  x: number,
  y: number,
  dir: Direction
): boolean {
  if (!inBounds(x, y)) return false;
  const tile = state.tiles[y][x];
  if (tile.isRocketSilo) return false;

  const def = BUILDINGS[type];
  if (def.unlockPhase > state.rocket.phase) {
    addFloatingText(
      state,
      x + 0.5,
      y + 0.2,
      `🔒 Phase ${def.unlockPhase} で解放されます!`,
      '#F59E0B',
      0.95
    );
    return false;
  }
  if (type === 'harvester' && !tile.resource) {
    addFloatingText(state, x + 0.5, y + 0.2, '資源の上に置いてね!', '#FB7185', 0.9);
    return false;
  }

  if (tile.buildingId) {
    const existing = state.buildings[tile.buildingId];
    if (existing) {
      // Allow quick direction update on same-type or belt-to-belt upgrade
      if (existing.type === type) {
        if (existing.dir !== dir) {
          existing.dir = dir;
          existing.bounceAnim = 0.7;
          audio.playRotate();
          return true;
        }
        return false;
      }
      const isExistingBelt = existing.type === 'belt' || existing.type === 'express_belt';
      const isNewBelt = type === 'belt' || type === 'express_belt';
      if (isExistingBelt && isNewBelt) {
        const diff = def.costStars - BUILDINGS[existing.type].costStars;
        if (diff > state.starSugar) {
          addFloatingText(state, x + 0.5, y + 0.2, '✨キラキラ星不足!', '#FBBF24', 0.9);
          return false;
        }
        state.starSugar -= diff;
        existing.type = type;
        existing.dir = dir;
        existing.bounceAnim = 1;
        audio.playPlace();
        return true;
      }
      return false;
    }
  }

  if (state.starSugar < def.costStars) {
    addFloatingText(
      state,
      x + 0.5,
      y + 0.2,
      `✨キラキラ星が${def.costStars}個必要!`,
      '#FBBF24',
      0.95
    );
    return false;
  }

  state.starSugar -= def.costStars;
  const b = createBuildingInstance(type, x, y, dir);
  b.bounceAnim = 1.0;
  state.buildings[b.id] = b;
  tile.buildingId = b.id;
  audio.playPlace();

  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    spawnParticle(
      state,
      x + 0.5,
      y + 0.5,
      Math.cos(a) * 1.4,
      Math.sin(a) * 1.4,
      def.accentColor,
      'puff',
      0.14,
      0.4
    );
  }
  return true;
}

export function demolishAt(state: GameState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const tile = state.tiles[y][x];
  if (!tile.buildingId) return false;
  const b = state.buildings[tile.buildingId];
  if (!b) {
    tile.buildingId = null;
    return false;
  }
  const refund = BUILDINGS[b.type].costStars;
  state.starSugar += refund;
  if (state.inspectedBuildingId === b.id) {
    state.inspectedBuildingId = null;
  }
  delete state.buildings[b.id];
  tile.buildingId = null;
  audio.playDemolish();

  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    spawnParticle(
      state,
      x + 0.5,
      y + 0.5,
      Math.cos(a) * 1.8,
      Math.sin(a) * 1.8,
      '#FDA4AF',
      'puff',
      0.16,
      0.4
    );
  }
  if (refund > 0) {
    addFloatingText(state, x + 0.5, y + 0.3, `+${refund}✨ 返却`, '#FDE047', 0.9);
  }
  return true;
}

function recordProduction(state: GameState): void {
  state.stats.totalProduced += 1;
  state.productionHistory.push(state.time);
  if (state.productionHistory.length > 800) {
    state.productionHistory.splice(0, state.productionHistory.length - 600);
  }
}

function deliverToRocket(state: GameState, itemId: ItemId, x: number, y: number): boolean {
  if (state.rocket.launched || state.rocket.launching) {
    // Still accept into celebration buffet so belts keep flowing!
    state.stats.totalDelivered += 1;
    spawnParticle(state, x + 0.5, y + 0.5, (Math.random() - 0.5) * 2, -1.8, '#FDE047', 'star', 0.16, 0.6);
    return true;
  }

  const req = ROCKET_PHASES[state.rocket.phase - 1];
  state.stats.totalDelivered += 1;

  if (req && req.requiredItems[itemId] !== undefined) {
    const need = req.requiredItems[itemId] ?? 0;
    const have = state.rocket.delivered[itemId] ?? 0;
    if (have < need) {
      state.rocket.delivered[itemId] = have + 1;
      addFloatingText(
        state,
        32,
        29.6,
        `+1 ${ITEMS[itemId].shortName} (${have + 1}/${need})`,
        '#FDE047',
        0.95
      );
      for (let i = 0; i < 4; i++) {
        spawnParticle(
          state,
          x + 0.5,
          y + 0.5,
          (Math.random() - 0.5) * 2.2,
          -1.6 - Math.random(),
          ITEMS[itemId].color,
          'star',
          0.16,
          0.65
        );
      }
      checkRocketPhaseProgress(state);
      return true;
    }
  }

  // Surplus / off-phase item politely converted into tiny snack shimmer so lines never clog!
  if (Math.random() < 0.35) {
    spawnParticle(state, x + 0.5, y + 0.5, (Math.random() - 0.5) * 1.4, -1.2, '#FBCFE8', 'heart', 0.13, 0.55);
  }
  return true;
}

export function canAdvanceRocketPhase(state: GameState): boolean {
  if (state.rocket.launching || state.rocket.launched || state.rocket.phase > ROCKET_PHASES.length) {
    return false;
  }
  const req = ROCKET_PHASES[state.rocket.phase - 1];
  if (!req) return false;
  if (state.starSugar < req.requiredStars) return false;
  for (const [id, need] of Object.entries(req.requiredItems)) {
    const have = state.rocket.delivered[id as ItemId] ?? 0;
    if (have < (need ?? 0)) return false;
  }
  return true;
}

export function checkRocketPhaseProgress(state: GameState): void {
  if (!canAdvanceRocketPhase(state)) return;
  const req = ROCKET_PHASES[state.rocket.phase - 1];
  state.starSugar -= req.requiredStars;

  if (state.rocket.phase < ROCKET_PHASES.length) {
    state.rocket.phase += 1;
    state.rocket.delivered = {};
    audio.playPhaseUp();
    const nextReq = ROCKET_PHASES[state.rocket.phase - 1];
    addFloatingText(
      state,
      32,
      28.8,
      `🎂 ${nextReq.partName}建造スタート!`,
      '#F472B6',
      1.35
    );
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * i) / 24;
      spawnParticle(
        state,
        32,
        32,
        Math.cos(a) * (2 + Math.random() * 2.5),
        Math.sin(a) * (2 + Math.random() * 2.5),
        i % 2 === 0 ? '#FDE047' : '#F472B6',
        'star',
        0.22,
        1.0
      );
    }
  } else {
    startRocketLaunchSequence(state);
  }
}

export function startRocketLaunchSequence(state: GameState): void {
  if (state.rocket.launching || state.rocket.launched) return;
  state.rocket.phase = ROCKET_PHASES.length;
  state.rocket.launching = true;
  state.rocket.launchCountdown = 10;
  audio.playPhaseUp();
  addFloatingText(state, 32, 28.5, '🚀 スイーツ・ロケット点火準備！キング軍団おやつパレード！', '#FDE047', 1.4);

  if (!state.peacefulMode) {
    // Festive final parade!
    spawnSlimeAtEdge(state, 'king_slime', 3);
    spawnSlimeAtEdge(state, 'king_slime', 1);
    for (let i = 0; i < 4; i++) {
      spawnSlimeAtEdge(state, 'pudding_slime', (i % 4) as Direction);
      spawnSlimeAtEdge(state, 'pink_slime', ((i + 1) % 4) as Direction);
    }
  }
}

export function advancePhaseForDemo(state: GameState): void {
  if (state.rocket.launching || state.rocket.launched) return;
  const req = ROCKET_PHASES[state.rocket.phase - 1];
  if (!req) return;
  for (const [id, need] of Object.entries(req.requiredItems)) {
    state.rocket.delivered[id as ItemId] = need ?? 0;
  }
  state.starSugar = Math.max(state.starSugar, req.requiredStars);
  checkRocketPhaseProgress(state);
}

function findMatchingRecipeForMachine(
  b: BuildingInstance
): Recipe | undefined {
  const list = RECIPES_BY_MACHINE[b.type];
  if (!list || list.length === 0) return undefined;

  if (b.selectedRecipeId) {
    const r = list.find((item) => item.id === b.selectedRecipeId);
    if (r) return r;
  }

  // Prefer a recipe whose inputs are currently satisfied
  for (const r of list) {
    let ok = true;
    for (const [itemId, qty] of Object.entries(r.inputs)) {
      if ((b.inputBuffer[itemId as ItemId] ?? 0) < (qty ?? 1)) {
        ok = false;
        break;
      }
    }
    if (ok) return r;
  }

  return undefined;
}

function doesMachineAcceptItem(b: BuildingInstance, itemId: ItemId): boolean {
  const list = RECIPES_BY_MACHINE[b.type];
  if (!list) return false;
  if ((b.inputBuffer[itemId] ?? 0) >= 16) return false;

  if (b.selectedRecipeId) {
    const r = list.find((rec) => rec.id === b.selectedRecipeId);
    return r ? (r.inputs[itemId] ?? 0) > 0 : false;
  }
  return list.some((rec) => (rec.inputs[itemId] ?? 0) > 0);
}

function tryPushToTile(
  state: GameState,
  targetX: number,
  targetY: number,
  fromDir: Direction,
  itemId: ItemId
): boolean {
  if (!inBounds(targetX, targetY)) return false;
  const tile = state.tiles[targetY][targetX];

  if (tile.isRocketSilo) {
    return deliverToRocket(state, itemId, targetX, targetY);
  }

  if (!tile.buildingId) return false;
  const target = state.buildings[tile.buildingId];
  if (!target) return false;

  if (target.type === 'belt' || target.type === 'express_belt') {
    if (target.beltItems.length >= 2) return false;
    const last = target.beltItems[target.beltItems.length - 1];
    if (last && last.progress < 0.46) return false;
    target.beltItems.push({
      id: genId('i'),
      itemId,
      progress: 0,
      fromDir,
    });
    return true;
  }

  if (target.type === 'splitter' || target.type === 'tunnel') {
    if (target.beltItems.length >= 2) return false;
    target.beltItems.push({
      id: genId('i'),
      itemId,
      progress: 0,
      fromDir,
    });
    return true;
  }

  if (
    target.type === 'oven' ||
    target.type === 'mixer' ||
    target.type === 'patisserie' ||
    target.type === 'confectioner'
  ) {
    if (!doesMachineAcceptItem(target, itemId)) return false;
    target.inputBuffer[itemId] = (target.inputBuffer[itemId] ?? 0) + 1;
    return true;
  }

  if (target.type === 'cannon' || target.type === 'gatling_cannon') {
    const totalAmmo = Object.values(target.ammoBuffer).reduce((a, c) => a + (c ?? 0), 0);
    if (totalAmmo >= 10) return false;
    target.ammoBuffer[itemId] = (target.ammoBuffer[itemId] ?? 0) + 1;
    return true;
  }

  return false;
}

function updateBuildings(state: GameState, dt: number, powerRatio: number): void {
  const all = Object.values(state.buildings);

  // 1. Harvesters & Processors
  for (const b of all) {
    if (b.bounceAnim > 0) {
      b.bounceAnim = Math.max(0, b.bounceAnim - dt * 4.5);
    }

    if (b.type === 'harvester') {
      const tile = state.tiles[b.y][b.x];
      if (!tile.resource) continue;
      if (b.outputBuffer.length < 2) {
        b.craftProgress += (dt * powerRatio) / 1.15;
        if (b.craftProgress >= 1) {
          b.craftProgress -= 1;
          b.outputBuffer.push(tile.resource);
          b.totalCrafted += 1;
          b.bounceAnim = 0.8;
          recordProduction(state);
        }
      }
      if (b.outputBuffer.length > 0) {
        const { dx, dy } = dirDelta(b.dir);
        const item = b.outputBuffer[0];
        if (tryPushToTile(state, b.x + dx, b.y + dy, oppositeDir(b.dir), item)) {
          b.outputBuffer.shift();
        }
      }
    } else if (
      b.type === 'oven' ||
      b.type === 'mixer' ||
      b.type === 'patisserie' ||
      b.type === 'confectioner'
    ) {
      const recipe = findMatchingRecipeForMachine(b);
      if (recipe && b.outputBuffer.length < 3) {
        let hasInputs = true;
        for (const [id, qty] of Object.entries(recipe.inputs)) {
          if ((b.inputBuffer[id as ItemId] ?? 0) < (qty ?? 1)) {
            hasInputs = false;
            break;
          }
        }
        if (hasInputs) {
          b.activeRecipeId = recipe.id;
          b.craftProgress += (dt * powerRatio) / recipe.durationSec;
          if (b.craftProgress >= 1) {
            b.craftProgress = 0;
            for (const [id, qty] of Object.entries(recipe.inputs)) {
              const k = id as ItemId;
              b.inputBuffer[k] = (b.inputBuffer[k] ?? 0) - (qty ?? 1);
            }
            for (let i = 0; i < recipe.outputCount; i++) {
              b.outputBuffer.push(recipe.output);
            }
            b.totalCrafted += recipe.outputCount;
            b.bounceAnim = 1.0;
            recordProduction(state);
          }
        } else {
          b.craftProgress = 0;
        }
      } else {
        b.craftProgress = 0;
      }

      if (b.outputBuffer.length > 0) {
        const { dx, dy } = dirDelta(b.dir);
        const outItem = b.outputBuffer[0];
        if (tryPushToTile(state, b.x + dx, b.y + dy, oppositeDir(b.dir), outItem)) {
          b.outputBuffer.shift();
        }
      }
    }
  }

  // 2. Logistics (belts, express_belts, splitters, tunnels)
  for (const b of all) {
    if (b.type === 'belt' || b.type === 'express_belt') {
      const speed = b.type === 'express_belt' ? 2.8 : 1.45;
      // Sort descending so front item advances first
      b.beltItems.sort((a, c) => c.progress - a.progress);
      for (let i = 0; i < b.beltItems.length; i++) {
        const item = b.beltItems[i];
        const maxProgress = i === 0 ? 1.0 : Math.max(0, b.beltItems[i - 1].progress - 0.45);
        item.progress = Math.min(maxProgress, item.progress + speed * dt);
      }

      if (b.beltItems.length > 0 && b.beltItems[0].progress >= 0.99) {
        const { dx, dy } = dirDelta(b.dir);
        const front = b.beltItems[0];
        if (tryPushToTile(state, b.x + dx, b.y + dy, oppositeDir(b.dir), front.itemId)) {
          b.beltItems.shift();
        }
      }
    } else if (b.type === 'splitter') {
      for (const item of b.beltItems) {
        item.progress = Math.min(1, item.progress + 2.2 * dt);
      }
      if (b.beltItems.length > 0 && b.beltItems[0].progress >= 0.5) {
        const item = b.beltItems[0];
        const dirs: Direction[] = [
          b.dir,
          ((b.dir + 1) % 4) as Direction,
          ((b.dir + 3) % 4) as Direction,
        ];
        let pushed = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          const idx = (b.splitterToggle + attempt) % 3;
          const outDir = dirs[idx];
          const { dx, dy } = dirDelta(outDir);
          if (tryPushToTile(state, b.x + dx, b.y + dy, oppositeDir(outDir), item.itemId)) {
            b.splitterToggle = (idx + 1) % 3;
            b.beltItems.shift();
            pushed = true;
            break;
          }
        }
        if (!pushed) {
          // Keep waiting
        }
      }
    } else if (b.type === 'tunnel') {
      for (const item of b.beltItems) {
        item.progress = Math.min(1, item.progress + 2.4 * dt);
      }
      if (b.beltItems.length > 0 && b.beltItems[0].progress >= 0.6) {
        const item = b.beltItems[0];
        const { dx, dy } = dirDelta(b.dir);
        // Look up to 4 tiles ahead for a matching exit tunnel
        let partner: BuildingInstance | null = null;
        for (let step = 1; step <= 4; step++) {
          const tx = b.x + dx * step;
          const ty = b.y + dy * step;
          if (!inBounds(tx, ty)) break;
          const tTile = state.tiles[ty][tx];
          if (tTile.buildingId) {
            const candidate = state.buildings[tTile.buildingId];
            if (candidate && candidate.type === 'tunnel' && candidate.dir === b.dir) {
              partner = candidate;
              break;
            }
          }
        }
        if (partner) {
          const outX = partner.x + dx;
          const outY = partner.y + dy;
          if (tryPushToTile(state, outX, outY, oppositeDir(partner.dir), item.itemId)) {
            b.beltItems.shift();
            b.bounceAnim = 0.6;
            partner.bounceAnim = 0.6;
          }
        } else {
          if (tryPushToTile(state, b.x + dx, b.y + dy, oppositeDir(b.dir), item.itemId)) {
            b.beltItems.shift();
          }
        }
      }
    }
  }

  // 3. Cannons
  for (const b of all) {
    if (b.type !== 'cannon' && b.type !== 'gatling_cannon') continue;
    if (b.cooldown > 0) {
      b.cooldown = Math.max(0, b.cooldown - dt * powerRatio);
    }

    const range = b.type === 'gatling_cannon' ? 9.5 : 7.5;
    const baseCooldown = b.type === 'gatling_cannon' ? 0.28 : 0.82;

    // Pick best ammo (highest calories first!)
    let bestAmmo: ItemId | null = null;
    let bestCal = -1;
    for (const [id, qty] of Object.entries(b.ammoBuffer)) {
      if ((qty ?? 0) > 0) {
        const cal = ITEMS[id as ItemId].calories;
        if (cal > bestCal) {
          bestCal = cal;
          bestAmmo = id as ItemId;
        }
      }
    }
    if (!bestAmmo) continue;

    // Find closest slime to silo within range
    const bx = b.x + 0.5;
    const by = b.y + 0.5;
    let target: Slime | null = null;
    let bestScore = Infinity;
    for (const s of state.slimes) {
      if (s.state === 'bouncing') continue;
      const distToCannon = Math.hypot(s.x - bx, s.y - by);
      if (distToCannon > range) continue;
      const distToSilo = Math.hypot(s.x - 32, s.y - 32);
      if (distToSilo < bestScore) {
        bestScore = distToSilo;
        target = s;
      }
    }

    if (target) {
      b.aimAngle = Math.atan2(target.y - by, target.x - bx);
      if (b.cooldown <= 0) {
        b.ammoBuffer[bestAmmo] = (b.ammoBuffer[bestAmmo] ?? 1) - 1;
        const itemDef = ITEMS[bestAmmo];
        const cdMult = itemDef.specialEffect === 'rapid' ? 0.6 : 1.0;
        b.cooldown = baseCooldown * cdMult;
        b.bounceAnim = 0.9;

        const speed = b.type === 'gatling_cannon' ? 14.5 : 11.5;
        state.projectiles.push({
          id: genId('p'),
          itemId: bestAmmo,
          x: bx + Math.cos(b.aimAngle) * 0.45,
          y: by + Math.sin(b.aimAngle) * 0.45,
          vx: Math.cos(b.aimAngle) * speed,
          vy: Math.sin(b.aimAngle) * speed,
          targetId: target.id,
          speed,
          angle: b.aimAngle,
          spin: (Math.random() - 0.5) * 10,
          calories: itemDef.calories * (b.type === 'gatling_cannon' ? 0.85 : 1.15),
          specialEffect: itemDef.specialEffect,
        });
        audio.playShoot();
      }
    }
  }
}

export function spawnSlimeAtEdge(
  state: GameState,
  type: SlimeType,
  edge: Direction
): void {
  const def = SLIME_DEFS[type];
  let x = 32;
  let y = 32;
  const spread = (Math.random() - 0.5) * 16;
  if (edge === 0) {
    x = 32 + spread;
    y = 1.5;
  } else if (edge === 1) {
    x = MAP_SIZE - 1.5;
    y = 32 + spread;
  } else if (edge === 2) {
    x = 32 + spread;
    y = MAP_SIZE - 1.5;
  } else {
    x = 1.5;
    y = 32 + spread;
  }

  const dx = x - 32;
  const dy = y - 32;
  const len = Math.hypot(dx, dy) || 1;
  const scaleHp = 1 + (state.rocket.phase - 1) * 0.15;

  state.slimes.push({
    id: genId('s'),
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    fed: 0,
    maxFed: Math.round(def.maxFed * scaleHp),
    state: 'approaching',
    slowTimer: 0,
    stunTimer: 0,
    wobblePhase: Math.random() * Math.PI * 2,
    chainCount: 0,
    squash: 0,
    originDirX: dx / len,
    originDirY: dy / len,
    ridingTimer: 0,
  });
}

export function summonWave(state: GameState, isRush = false): void {
  state.wave.waveNumber += 1;
  const wn = state.wave.waveNumber;
  const edge = state.wave.nextSpawnEdge;
  const count = isRush ? 5 + Math.min(6, wn) : 3 + Math.min(7, Math.floor(wn * 0.8));

  for (let i = 0; i < count; i++) {
    let kind: SlimeType = 'pink_slime';
    const roll = Math.random();
    if (wn >= 4 && i === 0 && (wn % 3 === 0 || isRush)) {
      kind = 'king_slime';
    } else if (wn >= 3 && roll < 0.28) {
      kind = 'pudding_slime';
    } else if (wn >= 2 && roll < 0.55) {
      kind = 'choco_slime';
    }
    spawnSlimeAtEdge(state, kind, edge);
  }

  state.wave.nextSpawnEdge = ((edge + 1) % 4) as Direction;
  state.wave.timer = state.wave.interval;
  const edgeLabels = ['北', '東', '南', '西'];
  addFloatingText(
    state,
    state.camera.x,
    state.camera.y - 2,
    isRush
      ? `🍮 おかわりラッシュ! (${edgeLabels[edge]}から来訪!)`
      : `🐾 腹ペコスライム隊が${edgeLabels[edge]}から接近中!`,
    '#F472B6',
    1.15
  );
}

function triggerSlimeBounce(state: GameState, s: Slime, chain: number): void {
  if (s.state === 'bouncing') return;
  s.state = 'bouncing';
  s.fed = s.maxFed;
  s.chainCount = chain;
  s.squash = 1.0;

  const dx = s.x - 32;
  const dy = s.y - 32;
  const len = Math.hypot(dx, dy) || 1;
  const dirX = len > 1 ? dx / len : s.originDirX;
  const dirY = len > 1 ? dy / len : s.originDirY;

  s.vx = dirX * 14;
  s.vy = dirY * 14;
  audio.playBounce(chain);

  const label = chain > 0 ? `ボヨヨン連鎖 x${chain + 1}!!` : 'まんぷくボヨヨ〜ン♡';
  addFloatingText(state, s.x, s.y - 0.6, label, chain > 0 ? '#FDE047' : '#F472B6', 1 + chain * 0.12);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    spawnParticle(
      state,
      s.x,
      s.y,
      Math.cos(a) * 2.5,
      Math.sin(a) * 2.5,
      i % 2 === 0 ? '#F472B6' : '#FDE047',
      'heart',
      0.18,
      0.7
    );
  }
}

function feedSlime(
  state: GameState,
  s: Slime,
  calories: number,
  effect: Projectile['specialEffect'] | 'none',
  hitVx = 0,
  hitVy = 0
): void {
  if (s.state === 'bouncing') return;
  s.fed += calories;
  s.squash = 0.85;
  audio.playMunch();

  if (effect === 'slow') {
    s.slowTimer = Math.max(s.slowTimer, 3.2);
  } else if (effect === 'stun') {
    s.stunTimer = Math.max(s.stunTimer, 2.5);
  } else if (effect === 'knockback') {
    const len = Math.hypot(hitVx, hitVy) || 1;
    s.x += (hitVx / len) * 0.9;
    s.y += (hitVy / len) * 0.9;
  }

  if (s.fed >= s.maxFed) {
    triggerSlimeBounce(state, s, s.chainCount);
  }
}

export function pokeSlimeAt(state: GameState, worldX: number, worldY: number): boolean {
  for (let i = state.slimes.length - 1; i >= 0; i--) {
    const s = state.slimes[i];
    if (s.state === 'bouncing') continue;
    const def = SLIME_DEFS[s.type];
    const ratio = Math.min(1, s.fed / s.maxFed);
    const radius = def.baseRadius * (1 + ratio * 1.15) + 0.35;
    const dist = Math.hypot(s.x - worldX, s.y - worldY);
    if (dist <= radius) {
      const dx = s.x - 32;
      const dy = s.y - 32;
      const len = Math.hypot(dx, dy) || 1;
      s.x += (dx / len) * 0.7;
      s.y += (dy / len) * 0.7;
      if (s.state === 'riding_belt') {
        s.state = 'approaching';
        s.ridingTimer = 0;
      }
      addFloatingText(state, s.x, s.y - 0.5, 'ぷにっ! +40kcal', '#38BDF8', 0.9);
      feedSlime(state, s, 40, 'none');
      return true;
    }
  }
  return false;
}

function updateProjectiles(state: GameState, dt: number): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    const target = state.slimes.find((s) => s.id === p.targetId && s.state !== 'bouncing');
    if (target) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      p.vx = (dx / dist) * p.speed;
      p.vy = (dy / dist) * p.speed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;

    // Collision with any non-bouncing slime
    let hitSlime: Slime | null = null;
    for (const s of state.slimes) {
      if (s.state === 'bouncing') continue;
      const def = SLIME_DEFS[s.type];
      const rad = def.baseRadius * (1 + Math.min(1, s.fed / s.maxFed) * 1.15) + 0.18;
      if (Math.hypot(s.x - p.x, s.y - p.y) <= rad) {
        hitSlime = s;
        break;
      }
    }

    if (hitSlime) {
      const itemDef = ITEMS[p.itemId];
      for (let k = 0; k < 4; k++) {
        spawnParticle(
          state,
          p.x,
          p.y,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          itemDef.color,
          'crumb',
          0.12,
          0.45
        );
      }
      feedSlime(state, hitSlime, p.calories, p.specialEffect, p.vx, p.vy);

      if (p.specialEffect === 'splash' || p.specialEffect === 'mega_splash') {
        const splashRadius = p.specialEffect === 'mega_splash' ? 3.2 : 2.1;
        spawnParticle(state, p.x, p.y, 0, 0, itemDef.color, 'ring', splashRadius, 0.35);
        for (const other of state.slimes) {
          if (other.id === hitSlime.id || other.state === 'bouncing') continue;
          if (Math.hypot(other.x - p.x, other.y - p.y) <= splashRadius) {
            feedSlime(state, other, p.calories * 0.65, 'none');
          }
        }
      }

      state.projectiles.splice(i, 1);
      continue;
    }

    if (p.x < 0 || p.x > MAP_SIZE || p.y < 0 || p.y > MAP_SIZE) {
      state.projectiles.splice(i, 1);
    }
  }
}

function updateSlimes(state: GameState, dt: number): void {
  for (let i = state.slimes.length - 1; i >= 0; i--) {
    const s = state.slimes[i];
    const def = SLIME_DEFS[s.type];
    s.wobblePhase += dt * (s.state === 'bouncing' ? 14 : 6);
    if (s.squash > 0) s.squash = Math.max(0, s.squash - dt * 4);
    if (s.slowTimer > 0) s.slowTimer = Math.max(0, s.slowTimer - dt);
    if (s.stunTimer > 0) s.stunTimer = Math.max(0, s.stunTimer - dt);

    if (s.state === 'bouncing') {
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Bowling chain collision!
      for (const other of state.slimes) {
        if (other.id === s.id || other.state === 'bouncing') continue;
        if (Math.hypot(other.x - s.x, other.y - s.y) < 1.15) {
          const nextChain = s.chainCount + 1;
          other.chainCount = Math.max(other.chainCount, nextChain);
          const ox = other.x - s.x;
          const oy = other.y - s.y;
          const olen = Math.hypot(ox, oy) || 1;
          other.x += (ox / olen) * 0.8;
          other.y += (oy / olen) * 0.8;
          feedSlime(state, other, Math.round(other.maxFed * 0.7), 'none');
        }
      }

      if (Math.random() < 0.45) {
        spawnParticle(state, s.x, s.y, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, '#FDE047', 'star', 0.14, 0.45);
      }

      const distFromCenter = Math.hypot(s.x - 32, s.y - 32);
      if (s.x < 0.5 || s.x > MAP_SIZE - 0.5 || s.y < 0.5 || s.y > MAP_SIZE - 0.5 || distFromCenter > 30) {
        const reward = def.starReward + Math.min(5, s.chainCount);
        state.starSugar += reward;
        state.stats.slimesFed += 1;
        state.stats.starsEarned += reward;
        state.stats.maxChain = Math.max(state.stats.maxChain, s.chainCount + 1);
        audio.playStar();
        addFloatingText(state, Math.min(MAP_SIZE - 2, Math.max(2, s.x)), Math.min(MAP_SIZE - 2, Math.max(2, s.y)), `+${reward}✨`, '#FDE047', 1.2);
        for (let k = 0; k < 10; k++) {
          const a = (Math.PI * 2 * k) / 10;
          spawnParticle(state, s.x, s.y, Math.cos(a) * 3, Math.sin(a) * 3, '#FDE047', 'star', 0.2, 0.7);
        }
        state.slimes.splice(i, 1);
      }
      continue;
    }

    if (s.state === 'riding_belt') {
      s.ridingTimer -= dt;
      const tx = Math.floor(s.x);
      const ty = Math.floor(s.y);
      const tile = inBounds(tx, ty) ? state.tiles[ty][tx] : null;
      const b = tile?.buildingId ? state.buildings[tile.buildingId] : null;
      if (b && (b.type === 'belt' || b.type === 'express_belt') && s.ridingTimer > 0) {
        const { dx, dy } = dirDelta(b.dir);
        const speed = b.type === 'express_belt' ? 2.4 : 1.3;
        s.x += dx * speed * dt;
        s.y += dy * speed * dt;
      } else {
        s.state = 'approaching';
      }
      continue;
    }

    // Approaching rocket silo gently
    if (s.stunTimer <= 0) {
      const dx = 32 - s.x;
      const dy = 32 - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speedMult = s.slowTimer > 0 ? 0.42 : 1.0;
      const step = def.speed * speedMult * dt;
      s.x += (dx / dist) * step;
      s.y += (dy / dist) * step;
    }

    // Non-destructive snack raid on belts: eats 1 item, falls asleep & rides belt!
    const tx = Math.floor(s.x);
    const ty = Math.floor(s.y);
    if (inBounds(tx, ty)) {
      const tile = state.tiles[ty][tx];
      if (tile.buildingId) {
        const b = state.buildings[tile.buildingId];
        if (b && (b.type === 'belt' || b.type === 'express_belt') && b.beltItems.length > 0 && s.stunTimer <= 0) {
          const snack = b.beltItems.shift()!;
          const snackDef = ITEMS[snack.itemId];
          s.state = 'riding_belt';
          s.ridingTimer = 2.4;
          addFloatingText(state, s.x, s.y - 0.5, 'つまみ食い♡ ｽﾔｧ…', '#FBCFE8', 0.85);
          feedSlime(state, s, snackDef.calories * 0.55, 'none');
        }
      }
    }

    // Reached central silo? Never breaks anything! Simply begs happily and gently bounces back a little
    if (s.x >= SILO_MIN - 0.2 && s.x <= SILO_MAX + 1.2 && s.y >= SILO_MIN - 0.2 && s.y <= SILO_MAX + 1.2) {
      const pushX = s.x - 32;
      const pushY = s.y - 32;
      const plen = Math.hypot(pushX, pushY) || 1;
      s.x = 32 + (pushX / plen) * 3.1;
      s.y = 32 + (pushY / plen) * 3.1;
      s.stunTimer = 1.2;
      addFloatingText(state, s.x, s.y - 0.6, 'おやつちょーだい♡', '#F9A8D4', 0.85);
    }
  }
}

function updateParticles(state: GameState, dt: number): void {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) {
      state.floatingTexts.splice(i, 1);
    }
  }
}

function stepSimulationSingle(state: GameState, dt: number): void {
  state.time += dt;
  state.stats.playTimeSec += dt;

  const power = computePowerStats(state);
  updateBuildings(state, dt, power.ratio);
  updateProjectiles(state, dt);
  updateSlimes(state, dt);

  // Wave timer
  if (!state.peacefulMode && !state.rocket.launching && !state.rocket.launched) {
    state.wave.timer -= dt;
    if (state.wave.timer <= 0) {
      summonWave(state, false);
    }
  }

  // Rocket countdown & launch animation
  if (state.rocket.launching && !state.rocket.launched) {
    state.rocket.launchCountdown -= dt;
    // Fluffy cotton-candy ignition smoke
    if (Math.random() < 0.7) {
      spawnParticle(
        state,
        32 + (Math.random() - 0.5) * 2.2,
        33.4,
        (Math.random() - 0.5) * 3.5,
        1.2 + Math.random() * 1.5,
        Math.random() < 0.5 ? '#FBCFE8' : '#FFF1F2',
        'cotton',
        0.42,
        1.1
      );
    }
    if (state.rocket.launchCountdown <= 0) {
      state.rocket.launchCountdown = 0;
      state.rocket.launched = true;
      state.rocket.launching = false;
      audio.playLaunch();
      // Feed every remaining slime on screen with celebratory feast!
      for (const s of state.slimes) {
        triggerSlimeBounce(state, s, s.chainCount + 1);
      }
      for (let i = 0; i < 45; i++) {
        const a = (Math.PI * 2 * i) / 45;
        spawnParticle(
          state,
          32,
          32,
          Math.cos(a) * (2 + Math.random() * 5),
          Math.sin(a) * (2 + Math.random() * 5),
          i % 3 === 0 ? '#FDE047' : i % 3 === 1 ? '#F472B6' : '#38BDF8',
          'star',
          0.26,
          1.4
        );
      }
    }
  } else if (state.rocket.launched && state.rocket.launchLiftY < 32) {
    state.rocket.launchLiftY += dt * (4.5 + state.rocket.launchLiftY * 0.9);
    for (let k = 0; k < 2; k++) {
      spawnParticle(
        state,
        32 + (Math.random() - 0.5) * 1.6,
        32.8 - state.rocket.launchLiftY * 0.35,
        (Math.random() - 0.5) * 4,
        2.5 + Math.random() * 2,
        k === 0 ? '#F9A8D4' : '#FEF08A',
        'cotton',
        0.55,
        1.2
      );
    }
  }

  updateParticles(state, dt);
}

export function stepSimulation(state: GameState, rawDt: number): void {
  if (state.paused) return;
  const speed = state.simSpeed || 1;
  const clampedFrameDt = Math.min(0.05, Math.max(0, rawDt));
  const totalDt = clampedFrameDt * speed;
  const maxStep = 0.025;
  const steps = Math.max(1, Math.ceil(totalDt / maxStep));
  const subDt = totalDt / steps;
  for (let i = 0; i < steps; i++) {
    stepSimulationSingle(state, subDt);
  }
}
