import { BUILDINGS } from '../data/buildings';
import { ITEMS, SLIME_DEFS } from '../data/items';
import {
  BuildingInstance,
  Direction,
  GameState,
  Slime,
} from '../types/game';
import { dirDelta, inBounds, MAP_SIZE, SILO_MAX, SILO_MIN } from '../core/world';
import { LoadedAssets } from './assetLoader';
import { SpriteBank } from './spriteBake';

const OUTLINE = '#5B3A4D';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points = 5
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export class GameRenderer {
  private sprites: SpriteBank;
  private assets: LoadedAssets | null = null;

  constructor(sprites: SpriteBank) {
    this.sprites = sprites;
  }

  setAssets(assets: LoadedAssets): void {
    this.assets = assets;
  }

  screenToWorld(
    state: GameState,
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ): { wx: number; wy: number; tx: number; ty: number } {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wx = state.camera.x + (sx - rect.width / 2) / state.camera.zoom;
    const wy = state.camera.y + (sy - rect.height / 2) / state.camera.zoom;
    return { wx, wy, tx: Math.floor(wx), ty: Math.floor(wy) };
  }

  render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    width: number,
    height: number,
    hoverTile: { x: number; y: number } | null
  ): void {
    const zoom = state.camera.zoom;
    ctx.save();

    // Sky/meadow background outside map
    ctx.fillStyle = '#B8E8BA';
    ctx.fillRect(0, 0, width, height);

    // Camera transform (world units = 1 tile)
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camera.x, -state.camera.y);

    const halfW = width / (2 * zoom) + 2;
    const halfH = height / (2 * zoom) + 2;
    const minX = Math.max(0, Math.floor(state.camera.x - halfW));
    const maxX = Math.min(MAP_SIZE - 1, Math.ceil(state.camera.x + halfW));
    const minY = Math.max(0, Math.floor(state.camera.y - halfH));
    const maxY = Math.min(MAP_SIZE - 1, Math.ceil(state.camera.y + halfH));

    // 1. Map border frame
    ctx.fillStyle = '#F9A8D4';
    drawRoundedRect(ctx, -0.45, -0.45, MAP_SIZE + 0.9, MAP_SIZE + 0.9, 0.5);
    ctx.fill();

    // 2. Ground tiles & resource nodes
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = state.tiles[y][x];
        const even = (x + y) % 2 === 0;
        ctx.fillStyle = even ? '#DCFCE7' : '#D1FAE5';
        ctx.fillRect(x, y, 1.01, 1.01);

        if (zoom >= 22 && !tile.isRocketSilo && !tile.resource && tile.decorSeed > 0.88) {
          // Cute tiny clover / pastel flower
          ctx.fillStyle = tile.decorSeed > 0.95 ? '#FBCFE8' : '#FEF08A';
          ctx.beginPath();
          ctx.arc(x + 0.28, y + 0.32, 0.06, 0, Math.PI * 2);
          ctx.arc(x + 0.34, y + 0.32, 0.06, 0, Math.PI * 2);
          ctx.fill();
        }

        if (tile.resource) {
          const itemDef = ITEMS[tile.resource];
          ctx.fillStyle = `${itemDef.color}36`;
          ctx.beginPath();
          ctx.arc(x + 0.5, y + 0.5, 0.44, 0, Math.PI * 2);
          ctx.fill();

          const spr = this.sprites.items[tile.resource];
          if (spr) {
            ctx.drawImage(spr, x + 0.14, y + 0.14, 0.72, 0.72);
          }
        }
      }
    }

    // Subtle grid lines when zoomed in
    if (zoom >= 26) {
      ctx.strokeStyle = 'rgba(91, 58, 77, 0.07)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      for (let x = minX; x <= maxX + 1; x++) {
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY + 1);
      }
      for (let y = minY; y <= maxY + 1; y++) {
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX + 1, y);
      }
      ctx.stroke();
    }

    // 3. Central 4x4 Waffle Launchpad Base
    this.drawLaunchpadBase(ctx, state);

    // 4. Belts, Splitters, Tunnels (floor logistics layer)
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const bid = state.tiles[y][x].buildingId;
        if (!bid) continue;
        const b = state.buildings[bid];
        if (!b) continue;
        if (
          b.type === 'belt' ||
          b.type === 'express_belt' ||
          b.type === 'splitter' ||
          b.type === 'tunnel'
        ) {
          this.drawLogistics(ctx, b, state.time);
        }
      }
    }

    // 5. Items riding on belts
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const bid = state.tiles[y][x].buildingId;
        if (!bid) continue;
        const b = state.buildings[bid];
        if (!b || b.beltItems.length === 0) continue;
        this.drawBeltItems(ctx, b);
      }
    }

    // 6. Machines, Windmills & Cannons
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const bid = state.tiles[y][x].buildingId;
        if (!bid) continue;
        const b = state.buildings[bid];
        if (!b) continue;
        if (
          b.type !== 'belt' &&
          b.type !== 'express_belt' &&
          b.type !== 'splitter' &&
          b.type !== 'tunnel'
        ) {
          this.drawMachine(ctx, b, state);
        }
      }
    }

    // 7. 5-Stage Sweets Rocket (drawn above pad and machines!)
    this.drawSweetsRocket(ctx, state);

    // 8. Hungry & Ballooned Slimes
    for (const s of state.slimes) {
      if (s.x < minX - 2 || s.x > maxX + 2 || s.y < minY - 2 || s.y > maxY + 2) continue;
      this.drawSlime(ctx, s, state.time);
    }

    // 9. Flying Snack Projectiles
    for (const p of state.projectiles) {
      const spr = this.sprites.items[p.itemId];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (spr) {
        ctx.drawImage(spr, -0.26, -0.26, 0.52, 0.52);
      }
      ctx.restore();
    }

    // 10. Particles & Floating Texts
    this.drawParticles(ctx, state);
    this.drawFloatingTexts(ctx, state);

    // 11. Inspected building highlight + Hover Ghost Preview
    if (state.inspectedBuildingId && state.buildings[state.inspectedBuildingId]) {
      const ib = state.buildings[state.inspectedBuildingId];
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 0.08;
      drawRoundedRect(ctx, ib.x + 0.02, ib.y + 0.02, 0.96, 0.96, 0.16);
      ctx.stroke();
    }

    if (hoverTile && inBounds(hoverTile.x, hoverTile.y)) {
      this.drawHoverPreview(ctx, state, hoverTile.x, hoverTile.y);
    }

    ctx.restore();

    // 12. Screen-space wave direction alert badge
    this.drawWaveEdgeBadge(ctx, state, width, height);
  }

  private drawLogistics(ctx: CanvasRenderingContext2D, b: BuildingInstance, time: number): void {
    ctx.save();
    ctx.translate(b.x + 0.5, b.y + 0.5);
    ctx.rotate((b.dir * Math.PI) / 2);

    if (b.type === 'belt' || b.type === 'express_belt') {
      const express = b.type === 'express_belt';
      // Outer pastel rail
      ctx.fillStyle = express ? '#BAE6FD' : '#FDE2E4';
      drawRoundedRect(ctx, -0.46, -0.46, 0.92, 0.92, 0.14);
      ctx.fill();

      // Inner moving track
      ctx.fillStyle = express ? '#38BDF8' : '#F472B6';
      drawRoundedRect(ctx, -0.34, -0.48, 0.68, 0.96, 0.08);
      ctx.fill();

      // Animated chevrons pointing North (-Y in local space)
      const speed = express ? 3.2 : 1.6;
      const offset = (time * speed) % 0.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.lineWidth = 0.075;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let cy = 0.5 - offset; cy >= -0.45; cy -= 0.5) {
        if (cy < -0.36 || cy > 0.42) continue;
        ctx.beginPath();
        ctx.moveTo(-0.18, cy + 0.1);
        ctx.lineTo(0, cy - 0.08);
        ctx.lineTo(0.18, cy + 0.1);
        ctx.stroke();
      }
    } else if (b.type === 'splitter') {
      ctx.fillStyle = '#DDD6FE';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.06;
      drawRoundedRect(ctx, -0.45, -0.45, 0.9, 0.9, 0.2);
      ctx.fill();
      ctx.stroke();

      // 3-way arrows
      ctx.fillStyle = '#7C3AED';
      for (const ang of [0, Math.PI / 2, -Math.PI / 2]) {
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, -0.38);
        ctx.lineTo(0.12, -0.2);
        ctx.lineTo(-0.12, -0.2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (b.type === 'tunnel') {
      ctx.fillStyle = '#FEF3C7';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.06;
      drawRoundedRect(ctx, -0.44, -0.44, 0.88, 0.88, 0.18);
      ctx.fill();
      ctx.stroke();

      // Arch hood
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0.04, 0.3, Math.PI, 0);
      ctx.lineTo(0.3, 0.28);
      ctx.lineTo(-0.3, 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Direction arrow
      ctx.fillStyle = '#FFFBEB';
      ctx.beginPath();
      ctx.moveTo(0, -0.35);
      ctx.lineTo(0.12, -0.18);
      ctx.lineTo(-0.12, -0.18);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawBeltItems(ctx: CanvasRenderingContext2D, b: BuildingInstance): void {
    const outDelta = dirDelta(b.dir);
    for (const bi of b.beltItems) {
      const inDelta = dirDelta(bi.fromDir);
      // Smooth quadratic interpolation from entry edge -> center -> exit edge
      const p = bi.progress;
      const startX = b.x + 0.5 + inDelta.dx * 0.45;
      const startY = b.y + 0.5 + inDelta.dy * 0.45;
      const midX = b.x + 0.5;
      const midY = b.y + 0.5;
      const endX = b.x + 0.5 + outDelta.dx * 0.45;
      const endY = b.y + 0.5 + outDelta.dy * 0.45;

      const inv = 1 - p;
      const ix = inv * inv * startX + 2 * inv * p * midX + p * p * endX;
      const iy = inv * inv * startY + 2 * inv * p * midY + p * p * endY;

      const spr = this.sprites.items[bi.itemId];
      if (spr) {
        ctx.drawImage(spr, ix - 0.27, iy - 0.27, 0.54, 0.54);
      }
    }
  }

  private drawMachine(ctx: CanvasRenderingContext2D, b: BuildingInstance, state: GameState): void {
    const def = BUILDINGS[b.type];
    const t = state.time;
    const working = b.craftProgress > 0.01;
    const pulse = working ? Math.sin(t * 9 + b.x) * 0.05 : 0;
    const bounce = b.bounceAnim * 0.14;
    const scaleX = 1 + pulse + bounce;
    const scaleY = 1 - pulse - bounce * 0.7;

    ctx.save();
    ctx.translate(b.x + 0.5, b.y + 0.5);

    // Ground drop shadow
    ctx.fillStyle = 'rgba(71, 45, 78, 0.18)';
    drawRoundedRect(ctx, -0.44, -0.36, 0.88, 0.84, 0.22);
    ctx.fill();

    ctx.scale(scaleX, scaleY);

    if (b.type === 'cannon' || b.type === 'gatling_cannon') {
      const isGatling = b.type === 'gatling_cannon';
      ctx.fillStyle = isGatling ? '#EDE9FE' : '#FCE7F3';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, 0.43, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rotating turret barrel
      ctx.save();
      ctx.rotate(b.aimAngle);
      ctx.fillStyle = isGatling ? '#8B5CF6' : '#EC4899';
      if (isGatling) {
        drawRoundedRect(ctx, 0.05, -0.18, 0.48, 0.1, 0.04);
        ctx.fill();
        ctx.stroke();
        drawRoundedRect(ctx, 0.05, 0.08, 0.48, 0.1, 0.04);
        ctx.fill();
        ctx.stroke();
      }
      drawRoundedRect(ctx, -0.05, -0.14, 0.54, 0.28, 0.1);
      ctx.fill();
      ctx.stroke();

      // Cute turret cap
      ctx.fillStyle = isGatling ? '#C4B5FD' : '#F9A8D4';
      ctx.beginPath();
      ctx.arc(0, 0, 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Ammo indicator badge
      const totalAmmo = Object.values(b.ammoBuffer).reduce((acc, v) => acc + (v ?? 0), 0);
      if (totalAmmo === 0) {
        ctx.fillStyle = '#FB7185';
        ctx.beginPath();
        ctx.arc(0.28, -0.28, 0.09, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#34D399';
        ctx.beginPath();
        ctx.arc(0.28, -0.28, 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    if (b.type === 'sugar_windmill') {
      ctx.fillStyle = '#D1FAE5';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Spinning candy windmill blades
      ctx.save();
      ctx.rotate(t * 2.4 + b.x);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = i % 2 === 0 ? '#34D399' : '#FDE047';
        drawRoundedRect(ctx, -0.07, -0.52, 0.14, 0.44, 0.06);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Machine body
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.06;
    drawRoundedRect(ctx, -0.44, -0.44, 0.88, 0.88, 0.2);
    ctx.fill();
    ctx.stroke();

    // Accent header band
    ctx.fillStyle = def.accentColor;
    drawRoundedRect(ctx, -0.38, -0.38, 0.76, 0.76, 0.16);
    ctx.fill();

    // Inner emblem per machine type
    if (b.type === 'harvester') {
      const bob = Math.sin(t * 7) * 0.04;
      ctx.fillStyle = '#FFFBEB';
      ctx.beginPath();
      ctx.arc(0, bob, 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(0, bob, 0.09, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === 'oven') {
      // Glowing warm bakery window
      ctx.fillStyle = working ? '#FDE047' : '#FDBA74';
      drawRoundedRect(ctx, -0.24, -0.18, 0.48, 0.36, 0.1);
      ctx.fill();
      ctx.stroke();
      if (working) {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0.02, 0.1 + Math.sin(t * 14) * 0.02, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.type === 'mixer') {
      ctx.fillStyle = '#EFF6FF';
      ctx.beginPath();
      ctx.arc(0, 0, 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.rotate(working ? t * 10 : t * 1.5);
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 0.065;
      ctx.beginPath();
      ctx.moveTo(-0.16, 0);
      ctx.lineTo(0.16, 0);
      ctx.moveTo(0, -0.16);
      ctx.lineTo(0, 0.16);
      ctx.stroke();
      ctx.restore();
    } else if (b.type === 'patisserie') {
      ctx.fillStyle = '#FFF1F2';
      drawRoundedRect(ctx, -0.24, -0.24, 0.48, 0.48, 0.12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.arc(0, 0, 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === 'confectioner') {
      ctx.fillStyle = '#FDF2F8';
      drawRoundedRect(ctx, -0.27, -0.27, 0.54, 0.54, 0.14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FDE047';
      drawStar(ctx, 0, 0, 0.18, 0.08, 5);
      ctx.fill();
      ctx.stroke();
    }

    // Output direction arrow indicator
    ctx.save();
    ctx.rotate((b.dir * Math.PI) / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(0, -0.48);
    ctx.lineTo(0.12, -0.33);
    ctx.lineTo(-0.12, -0.33);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Craft progress mini bar at bottom
    if (working) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      drawRoundedRect(ctx, -0.3, 0.3, 0.6, 0.09, 0.04);
      ctx.fill();
      ctx.fillStyle = '#34D399';
      drawRoundedRect(ctx, -0.3, 0.3, 0.6 * Math.min(1, b.craftProgress), 0.09, 0.04);
      ctx.fill();
    }

    // Status LED
    ctx.fillStyle = working ? '#34D399' : '#FDE047';
    ctx.beginPath();
    ctx.arc(0.3, -0.3, 0.075, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawLaunchpadBase(ctx: CanvasRenderingContext2D, state: GameState): void {
    const x = SILO_MIN;
    const y = SILO_MIN;
    const size = SILO_MAX - SILO_MIN + 1;

    // Waffle launchpad foundation
    ctx.save();
    ctx.fillStyle = 'rgba(91, 58, 77, 0.18)';
    drawRoundedRect(ctx, x - 0.05, y + 0.12, size + 0.1, size + 0.08, 0.45);
    ctx.fill();

    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.08;
    drawRoundedRect(ctx, x, y, size, size, 0.4);
    ctx.fill();
    ctx.stroke();

    // Waffle grid grooves
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 0.06;
    for (let i = 0.5; i < size; i += 0.5) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + 0.2);
      ctx.lineTo(x + i, y + size - 0.2);
      ctx.moveTo(x + 0.2, y + i);
      ctx.lineTo(x + size - 0.2, y + i);
      ctx.stroke();
    }

    // Central glowing sugar launch ring
    const pulse = Math.sin(state.time * 3.5) * 0.08;
    ctx.fillStyle = '#FFF1F2';
    ctx.strokeStyle = '#F472B6';
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.arc(32, 32, 1.35 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawSweetsRocket(ctx: CanvasRenderingContext2D, state: GameState): void {
    const phase = state.rocket.phase;
    const lift = state.rocket.launchLiftY;
    const shake = state.rocket.launching
      ? Math.sin(state.time * 48) * 0.07
      : 0;

    ctx.save();
    ctx.translate(32 + shake, 32 - lift * 0.45);

    // Shadow on pad shrinks as rocket climbs
    const shadowScale = Math.max(0.1, 1 - lift * 0.04);
    ctx.save();
    ctx.translate(0, lift * 0.45);
    ctx.scale(shadowScale, shadowScale);
    ctx.fillStyle = 'rgba(71, 45, 78, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0.7, 1.15, 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Scale up slightly when lifting off for heroic perspective
    const rocketScale = 1 + Math.min(0.45, lift * 0.015);
    ctx.scale(rocketScale, rocketScale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Phase 1: Biscuit Launch Fins & Base
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.075;
    drawRoundedRect(ctx, -0.95, 0.1, 1.9, 0.65, 0.25);
    ctx.fill();
    ctx.stroke();

    // Phase 3+: Maple Syrup Side Boosters
    if (phase >= 3) {
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#F59E0B';
        drawRoundedRect(ctx, side * 0.92 - 0.24, -0.9, 0.48, 1.35, 0.22);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FEF08A';
        drawRoundedRect(ctx, side * 0.92 - 0.12, -0.55, 0.24, 0.72, 0.08);
        ctx.fill();
      }
    }

    // Phase 2+: Candy Cane Striped Fuselage
    if (phase >= 2) {
      drawRoundedRect(ctx, -0.68, -1.65, 1.36, 1.95, 0.35);
      ctx.fillStyle = '#F472B6';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#FFF1F2';
      for (let sy = -2.2; sy < 1.2; sy += 0.48) {
        ctx.beginPath();
        ctx.moveTo(-1, sy);
        ctx.lineTo(1, sy - 0.45);
        ctx.lineTo(1, sy - 0.2);
        ctx.lineTo(-1, sy + 0.25);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = OUTLINE;
      drawRoundedRect(ctx, -0.68, -1.65, 1.36, 1.95, 0.35);
      ctx.stroke();

      // Porthole window
      ctx.fillStyle = '#BAE6FD';
      ctx.beginPath();
      ctx.arc(0, -0.75, 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Phase 4+: Patisserie Decorative Ring
    if (phase >= 4) {
      ctx.fillStyle = '#A78BFA';
      drawRoundedRect(ctx, -0.78, -0.25, 1.56, 0.28, 0.12);
      ctx.fill();
      ctx.stroke();
    }

    // Phase 5+: Composite Candy Hull Skirt
    if (phase >= 5) {
      ctx.fillStyle = '#FBCFE8';
      drawRoundedRect(ctx, -1.08, 0.05, 2.16, 0.35, 0.14);
      ctx.fill();
      ctx.stroke();
    }

    // Phase 6+: Pancake Booster Glow Ring
    if (phase >= 6) {
      ctx.fillStyle = '#FDE047';
      drawRoundedRect(ctx, -0.58, -1.35, 1.16, 0.2, 0.08);
      ctx.fill();
      ctx.stroke();
    }

    // Phase 7+: Strawberry Shortcake Nose Cone & Macaron Dish
    if (phase >= 7) {
      ctx.fillStyle = '#FFFDF9';
      ctx.beginPath();
      ctx.moveTo(-0.75, -1.45);
      ctx.quadraticCurveTo(0, -2.75, 0.75, -1.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Strawberry crown on top!
      ctx.fillStyle = '#E11D48';
      ctx.beginPath();
      ctx.arc(0, -2.35, 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.ellipse(0, -2.6, 0.2, 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Phase 8+: Golden Satellite Wings & Star Engine Glow
    if (phase >= 8 || state.rocket.launching || state.rocket.launched) {
      const glow = 0.26 + Math.sin(state.time * 12) * 0.07;
      ctx.fillStyle = '#38BDF8';
      drawStar(ctx, 0, -0.75, glow, glow * 0.45, 5);
      ctx.fill();

      ctx.fillStyle = '#38BDF8';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.06;
      drawRoundedRect(ctx, -1.35, -1.85, 0.45, 0.28, 0.06);
      ctx.fill();
      ctx.stroke();
      drawRoundedRect(ctx, 0.9, -1.85, 0.45, 0.28, 0.06);
      ctx.fill();
      ctx.stroke();
    }

    // Cotton-candy jet flame when launching/launched
    if (state.rocket.launching || state.rocket.launched) {
      const f = 0.65 + Math.sin(state.time * 32) * 0.18;
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.moveTo(-0.42, 0.7);
      ctx.lineTo(0, 0.7 + f * 1.4);
      ctx.lineTo(0.42, 0.7);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawSlime(ctx: CanvasRenderingContext2D, s: Slime, time: number): void {
    const def = SLIME_DEFS[s.type];
    const ratio = Math.min(1, s.fed / s.maxFed);
    // Balloon inflation up to 2.15x radius!!
    const r = def.baseRadius * (1 + ratio * 1.15);

    const wobble = Math.sin(s.wobblePhase) * (0.08 + ratio * 0.07);
    const sq = s.squash * 0.25;
    const sx = 1 + wobble + sq;
    const sy = 1 - wobble - sq * 0.7;

    ctx.save();
    ctx.translate(s.x, s.y);

    // Shadow
    ctx.fillStyle = 'rgba(71, 45, 78, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.72, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (s.state === 'bouncing') {
      ctx.rotate(time * 9);
    } else if (s.state === 'riding_belt') {
      ctx.rotate(Math.sin(time * 4) * 0.18);
    }
    ctx.scale(sx, sy);

    // Jelly body
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r);
    g.addColorStop(0, def.bellyColor);
    g.addColorStop(1, def.color);
    ctx.fillStyle = g;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.065;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gloss highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.38, r * 0.24, r * 0.13, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Rosy cheeks (get bigger as slime fills up!)
    ctx.fillStyle = 'rgba(244, 63, 94, 0.48)';
    const cheekR = r * (0.14 + ratio * 0.1);
    ctx.beginPath();
    ctx.arc(-r * 0.46, r * 0.1, cheekR, 0, Math.PI * 2);
    ctx.arc(r * 0.46, r * 0.1, cheekR, 0, Math.PI * 2);
    ctx.fill();

    // Expressive Face
    ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = OUTLINE;
    ctx.lineWidth = Math.max(0.04, r * 0.08);
    ctx.lineCap = 'round';

    if (s.state === 'bouncing') {
      // Blissful happy bloated face (> w <)
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, -r * 0.18);
      ctx.lineTo(-r * 0.22, -r * 0.06);
      ctx.lineTo(-r * 0.42, r * 0.04);
      ctx.moveTo(r * 0.42, -r * 0.18);
      ctx.lineTo(r * 0.22, -r * 0.06);
      ctx.lineTo(r * 0.42, r * 0.04);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-r * 0.08, r * 0.1, r * 0.09, 0, Math.PI);
      ctx.arc(r * 0.08, r * 0.1, r * 0.09, 0, Math.PI);
      ctx.stroke();
    } else if (s.state === 'riding_belt') {
      // Sleepy Zzz face
      ctx.beginPath();
      ctx.moveTo(-r * 0.38, -r * 0.08);
      ctx.lineTo(-r * 0.16, -r * 0.08);
      ctx.moveTo(r * 0.16, -r * 0.08);
      ctx.lineTo(r * 0.38, -r * 0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.14, r * 0.1, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ratio >= 0.4) {
      // Stuffing cheeks! (^ w ^)
      ctx.beginPath();
      ctx.arc(-r * 0.28, -r * 0.06, r * 0.11, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.28, -r * 0.06, r * 0.11, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.07, r * 0.1, r * 0.08, 0, Math.PI);
      ctx.arc(r * 0.07, r * 0.1, r * 0.08, 0, Math.PI);
      ctx.stroke();
    } else {
      // Hungry wide eyes + tiny drool drop
      ctx.beginPath();
      ctx.arc(-r * 0.26, -r * 0.1, r * 0.08, 0, Math.PI * 2);
      ctx.arc(r * 0.26, -r * 0.1, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, r * 0.14, r * 0.12, r * 0.09, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FB7185';
      ctx.fill();
    }

    // Golden Crown for King Slime
    if (s.type === 'king_slime') {
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.78);
      ctx.lineTo(-r * 0.52, -r * 1.25);
      ctx.lineTo(-r * 0.2, -r * 0.98);
      ctx.lineTo(0, -r * 1.35);
      ctx.lineTo(r * 0.2, -r * 0.98);
      ctx.lineTo(r * 0.52, -r * 1.25);
      ctx.lineTo(r * 0.45, -r * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // Fullness bar above slime
    if (s.state !== 'bouncing' && ratio > 0.01) {
      const bw = Math.max(0.7, r * 1.6);
      ctx.fillStyle = 'rgba(91, 58, 77, 0.55)';
      drawRoundedRect(ctx, -bw / 2, -r - 0.26, bw, 0.12, 0.06);
      ctx.fill();
      ctx.fillStyle = ratio > 0.75 ? '#FDE047' : '#F472B6';
      drawRoundedRect(ctx, -bw / 2, -r - 0.26, bw * ratio, 0.12, 0.06);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.09;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.15 - alpha * 0.5), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'star') {
        ctx.fillStyle = p.color;
        drawStar(ctx, 0, 0, p.size, p.size * 0.45, 5);
        ctx.fill();
      } else if (p.kind === 'cotton') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.4 - alpha * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ft of state.floatingTexts) {
      const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${0.34 * ft.scale}px "M PLUS Rounded 1c", sans-serif`;
      ctx.lineWidth = 0.09;
      ctx.strokeStyle = '#5B3A4D';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  private drawHoverPreview(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    tx: number,
    ty: number
  ): void {
    const tool = state.selectedTool;
    if (tool === 'inspect') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.07;
      drawRoundedRect(ctx, tx + 0.04, ty + 0.04, 0.92, 0.92, 0.16);
      ctx.stroke();
      return;
    }

    if (tool === 'demolish') {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
      ctx.strokeStyle = '#E11D48';
      ctx.lineWidth = 0.08;
      drawRoundedRect(ctx, tx + 0.04, ty + 0.04, 0.92, 0.92, 0.16);
      ctx.fill();
      ctx.stroke();
      return;
    }

    const def = BUILDINGS[tool];
    const tile = state.tiles[ty][tx];
    const valid =
      def.unlockPhase <= state.rocket.phase &&
      !tile.isRocketSilo &&
      (tool !== 'harvester' || Boolean(tile.resource));

    ctx.save();
    ctx.translate(tx + 0.5, ty + 0.5);

    if (tool === 'cannon' || tool === 'gatling_cannon') {
      const range = tool === 'gatling_cannon' ? 9.5 : 7.5;
      ctx.fillStyle = 'rgba(244, 114, 182, 0.1)';
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.55)';
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = valid ? `${def.accentColor}88` : 'rgba(244, 63, 94, 0.55)';
    ctx.strokeStyle = valid ? '#FFFFFF' : '#E11D48';
    ctx.lineWidth = 0.06;
    drawRoundedRect(ctx, -0.44, -0.44, 0.88, 0.88, 0.18);
    ctx.fill();
    ctx.stroke();

    // Direction preview arrow
    ctx.rotate((state.buildDir * Math.PI) / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, -0.36);
    ctx.lineTo(0.18, -0.05);
    ctx.lineTo(0.06, -0.05);
    ctx.lineTo(0.06, 0.28);
    ctx.lineTo(-0.06, 0.28);
    ctx.lineTo(-0.06, -0.05);
    ctx.lineTo(-0.18, -0.05);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawWaveEdgeBadge(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    width: number,
    height: number
  ): void {
    if (state.peacefulMode || state.rocket.launching || state.rocket.launched) return;
    const edge: Direction = state.wave.nextSpawnEdge;
    const sec = Math.max(0, Math.ceil(state.wave.timer));
    const label = `🐾 ${sec}秒`;

    let bx = width / 2;
    let by = 92;
    if (edge === 1) {
      bx = width - 84;
      by = height / 2;
    } else if (edge === 2) {
      bx = width / 2;
      by = height - 115;
    } else if (edge === 3) {
      bx = 84;
      by = height / 2;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.strokeStyle = '#F472B6';
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, bx - 44, by - 16, 88, 32, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#5B3A4D';
    ctx.font = '800 13px "M PLUS Rounded 1c", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx, by + 1);
    ctx.restore();
  }

  getAssets(): LoadedAssets | null {
    return this.assets;
  }
}
