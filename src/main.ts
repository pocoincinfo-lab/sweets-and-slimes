import './style.css';
import { audio } from './core/audio';
import {
  addFloatingText,
  advancePhaseForDemo,
  demolishAt,
  placeBuilding,
  pokeSlimeAt,
  stepSimulation,
  summonWave,
} from './core/simulation';
import { clearSavedGameState, loadGameState, saveGameState } from './core/storage';
import { createInitialGameState, inBounds, MAP_SIZE } from './core/world';
import { loadGameAssets } from './render/assetLoader';
import { GameRenderer } from './render/renderer';
import { createSpriteBank } from './render/spriteBake';
import { BuildingType, Direction, GameState } from './types/game';
import { GameHud } from './ui/hud';
import { BUILDING_LIST } from './data/buildings';

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const hudRoot = document.getElementById('hud-root') as HTMLElement;
  const ctx = canvas.getContext('2d')!;

  const sprites = createSpriteBank();
  const assets = await loadGameAssets();
  const renderer = new GameRenderer(sprites);
  renderer.setAssets(assets);

  let state: GameState = loadGameState();

  const keysPressed = new Set<string>();
  let hoverTile: { x: number; y: number } | null = null;
  let isPanning = false;
  let panStartScreen = { x: 0, y: 0 };
  let panStartCam = { x: 0, y: 0 };
  let rightClickMoved = false;

  let isLeftDragging = false;
  let lastBeltDragTile: { x: number; y: number } | null = null;

  const hud = new GameHud(hudRoot, sprites, assets, {
    onSelectTool: (tool) => {
      state.selectedTool = tool;
    },
    onRotate: () => {
      state.buildDir = ((state.buildDir + 1) % 4) as Direction;
      audio.playRotate();
    },
    onCenterSilo: () => {
      state.camera.x = 32;
      state.camera.y = 32;
    },
    onJumpCamera: (tx, ty) => {
      state.camera.x = Math.max(0, Math.min(MAP_SIZE, tx));
      state.camera.y = Math.max(0, Math.min(MAP_SIZE, ty));
    },
    onRushWave: () => {
      audio.unlock();
      if (state.peacefulMode) {
        state.peacefulMode = false;
      }
      summonWave(state, true);
    },
    onTogglePeaceful: () => {
      state.peacefulMode = !state.peacefulMode;
      addFloatingText(
        state,
        state.camera.x,
        state.camera.y - 1.5,
        state.peacefulMode ? '🕊️ 平和モードON（ゆっくり工場建設）' : '🐾 おやつ防衛モードON!',
        '#34D399',
        1.1
      );
    },
    onDemoAdvancePhase: () => {
      audio.unlock();
      advancePhaseForDemo(state);
    },
    onToggleMute: () => {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
    },
    onTogglePause: () => {
      state.paused = !state.paused;
    },
    onCycleSpeed: () => {
      state.simSpeed = state.simSpeed === 1 ? 2 : state.simSpeed === 2 ? 5 : 1;
      addFloatingText(
        state,
        state.camera.x,
        state.camera.y - 1.2,
        `⏩ シミュレーション速度 ${state.simSpeed}x`,
        '#38BDF8',
        1.05
      );
    },
    onSave: () => {
      const ok = saveGameState(state);
      addFloatingText(
        state,
        state.camera.x,
        state.camera.y - 1,
        ok ? '💾 工場をセーブしました！' : 'セーブに失敗しました',
        '#38BDF8',
        1.1
      );
    },
    onReset: () => {
      clearSavedGameState();
      state = createInitialGameState();
      audio.setMuted(state.muted);
      addFloatingText(state, 32, 30, '🌱 新しいお菓子惑星へ到着！', '#F472B6', 1.2);
    },
    onDismissVictory: () => {
      state.unlockedModalDismissed = true;
    },
    onSelectRecipe: (buildingId, recipeId) => {
      const b = state.buildings[buildingId];
      if (b) {
        b.selectedRecipeId = recipeId;
        b.craftProgress = 0;
        audio.playRotate();
      }
    },
    onCloseInspect: () => {
      state.inspectedBuildingId = null;
    },
  });

  audio.setMuted(state.muted);

  function resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keysPressed.add(k);

    if (hud.isWelcomeOpen() && (k === 'enter' || k === 'escape')) {
      hud.hideWelcome();
      return;
    }

    if (k === 'r') {
      state.buildDir = ((state.buildDir + 1) % 4) as Direction;
      audio.playRotate();
    } else if (k === 'x') {
      state.selectedTool = state.selectedTool === 'demolish' ? 'belt' : 'demolish';
    } else if (k === 'q') {
      state.selectedTool = 'inspect';
    } else if (k === 'h') {
      state.camera.x = 32;
      state.camera.y = 32;
    } else if (k === ' ') {
      e.preventDefault();
      state.paused = !state.paused;
    } else {
      const match = BUILDING_LIST.find((b) => b.hotkey === e.key);
      if (match) {
        state.selectedTool = match.type as BuildingType;
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keysPressed.delete(e.key.toLowerCase());
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    const { wx, wy, tx, ty } = renderer.screenToWorld(state, canvas, e.clientX, e.clientY);
    hoverTile = { x: tx, y: ty };

    if (e.button === 2 || e.button === 1) {
      isPanning = true;
      rightClickMoved = false;
      panStartScreen = { x: e.clientX, y: e.clientY };
      panStartCam = { x: state.camera.x, y: state.camera.y };
      return;
    }

    if (e.button === 0) {
      // Direct slime poke first if clicking directly on a slime!
      if (pokeSlimeAt(state, wx, wy)) {
        return;
      }

      isLeftDragging = true;

      if (state.selectedTool === 'demolish') {
        demolishAt(state, tx, ty);
        return;
      }

      if (state.selectedTool === 'inspect') {
        if (inBounds(tx, ty)) {
          state.inspectedBuildingId = state.tiles[ty][tx].buildingId;
        }
        return;
      }

      // If clicking an existing non-belt machine with any tool, inspect it gently if place fails
      if (inBounds(tx, ty) && state.tiles[ty][tx].buildingId) {
        const existing = state.buildings[state.tiles[ty][tx].buildingId!];
        if (
          existing &&
          existing.type !== 'belt' &&
          existing.type !== 'express_belt' &&
          existing.type !== state.selectedTool
        ) {
          state.inspectedBuildingId = existing.id;
          return;
        }
      }

      const placed = placeBuilding(state, state.selectedTool, tx, ty, state.buildDir);
      if (
        (state.selectedTool === 'belt' || state.selectedTool === 'express_belt') &&
        inBounds(tx, ty)
      ) {
        lastBeltDragTile = { x: tx, y: ty };
      } else if (placed && inBounds(tx, ty)) {
        const bid = state.tiles[ty][tx].buildingId;
        if (
          bid &&
          (state.selectedTool === 'oven' ||
            state.selectedTool === 'mixer' ||
            state.selectedTool === 'patisserie' ||
            state.selectedTool === 'confectioner')
        ) {
          state.inspectedBuildingId = bid;
        }
      }
    }
  });

  window.addEventListener('pointermove', (e) => {
    const { tx, ty } = renderer.screenToWorld(state, canvas, e.clientX, e.clientY);
    hoverTile = { x: tx, y: ty };

    if (isPanning) {
      const dx = e.clientX - panStartScreen.x;
      const dy = e.clientY - panStartScreen.y;
      if (Math.hypot(dx, dy) > 5) {
        rightClickMoved = true;
      }
      state.camera.x = Math.max(
        0,
        Math.min(MAP_SIZE, panStartCam.x - dx / state.camera.zoom)
      );
      state.camera.y = Math.max(
        0,
        Math.min(MAP_SIZE, panStartCam.y - dy / state.camera.zoom)
      );
      return;
    }

    if (isLeftDragging && inBounds(tx, ty)) {
      if (state.selectedTool === 'demolish') {
        demolishAt(state, tx, ty);
        return;
      }

      if (state.selectedTool === 'belt' || state.selectedTool === 'express_belt') {
        if (lastBeltDragTile && (lastBeltDragTile.x !== tx || lastBeltDragTile.y !== ty)) {
          const dx = tx - lastBeltDragTile.x;
          const dy = ty - lastBeltDragTile.y;
          // Only auto-orient on orthogonal adjacent steps
          if (Math.abs(dx) + Math.abs(dy) === 1) {
            let newDir: Direction = state.buildDir;
            if (dy === -1) newDir = 0;
            else if (dx === 1) newDir = 1;
            else if (dy === 1) newDir = 2;
            else if (dx === -1) newDir = 3;

            state.buildDir = newDir;
            // Orient previous belt toward the drag vector to create effortless L-curves!
            const prevTile = state.tiles[lastBeltDragTile.y]?.[lastBeltDragTile.x];
            if (prevTile?.buildingId) {
              const prevB = state.buildings[prevTile.buildingId];
              if (prevB && (prevB.type === 'belt' || prevB.type === 'express_belt')) {
                prevB.dir = newDir;
              }
            }
            placeBuilding(state, state.selectedTool, tx, ty, newDir);
            lastBeltDragTile = { x: tx, y: ty };
          } else if (Math.abs(dx) + Math.abs(dy) > 1) {
            placeBuilding(state, state.selectedTool, tx, ty, state.buildDir);
            lastBeltDragTile = { x: tx, y: ty };
          }
        }
      } else if (state.selectedTool !== 'inspect') {
        // Allow continuous brush placement of harvesters, ovens, mixers, windmills, etc. on empty tiles
        if (!state.tiles[ty][tx].buildingId) {
          placeBuilding(state, state.selectedTool, tx, ty, state.buildDir);
        }
      }
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (isPanning && e.button === 2 && !rightClickMoved) {
      const { tx, ty } = renderer.screenToWorld(state, canvas, e.clientX, e.clientY);
      demolishAt(state, tx, ty);
    }
    if (e.button === 2 || e.button === 1) {
      isPanning = false;
    }
    if (e.button === 0) {
      isLeftDragging = false;
      lastBeltDragTile = null;
    }
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const before = renderer.screenToWorld(state, canvas, e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      state.camera.zoom = Math.max(16, Math.min(86, state.camera.zoom * factor));
      const after = renderer.screenToWorld(state, canvas, e.clientX, e.clientY);
      state.camera.x = Math.max(0, Math.min(MAP_SIZE, state.camera.x + (before.wx - after.wx)));
      state.camera.y = Math.max(0, Math.min(MAP_SIZE, state.camera.y + (before.wy - after.wy)));
    },
    { passive: false }
  );

  let lastTime = performance.now();
  let autosaveTimer = 0;

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    // Smooth keyboard camera pan
    const camSpeed = (16 * 40) / state.camera.zoom;
    if (keysPressed.has('w') || keysPressed.has('arrowup')) {
      state.camera.y = Math.max(0, state.camera.y - camSpeed * dt);
    }
    if (keysPressed.has('s') || keysPressed.has('arrowdown')) {
      state.camera.y = Math.min(MAP_SIZE, state.camera.y + camSpeed * dt);
    }
    if (keysPressed.has('a') || keysPressed.has('arrowleft')) {
      state.camera.x = Math.max(0, state.camera.x - camSpeed * dt);
    }
    if (keysPressed.has('d') || keysPressed.has('arrowright')) {
      state.camera.x = Math.min(MAP_SIZE, state.camera.x + camSpeed * dt);
    }

    stepSimulation(state, dt);
    renderer.render(ctx, state, window.innerWidth, window.innerHeight, hoverTile);
    hud.sync(state);

    const miniCanvas = hud.getMinimapCanvas();
    if (miniCanvas) {
      const mctx = miniCanvas.getContext('2d');
      if (mctx) {
        renderer.renderMinimap(
          mctx,
          state,
          miniCanvas.width,
          miniCanvas.height,
          window.innerWidth,
          window.innerHeight
        );
      }
    }

    autosaveTimer += dt;
    if (autosaveTimer >= 10) {
      autosaveTimer = 0;
      saveGameState(state);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

void bootstrap();
