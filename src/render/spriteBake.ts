import { ITEM_LIST } from '../data/items';
import { ItemId } from '../types/game';

export interface SpriteBank {
  items: Record<ItemId, HTMLCanvasElement>;
  itemDataUrls: Record<ItemId, string>;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

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

function drawStarShape(
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

function paintItemSprite(id: ItemId, size = 128): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size);
  const cx = size / 2;
  const s = size / 128;

  ctx.save();
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Soft ground shadow
  ctx.fillStyle = 'rgba(71, 45, 78, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, 108, 36, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  const outline = '#5B3A4D';

  switch (id) {
    case 'wheat': {
      // Golden wheat bundle tied with pink ribbon
      for (const ang of [-0.26, 0, 0.26]) {
        ctx.save();
        ctx.translate(cx, 92);
        ctx.rotate(ang);
        ctx.strokeStyle = outline;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(0, -56);
        ctx.stroke();

        ctx.strokeStyle = '#EAB308';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(0, -56);
        ctx.stroke();

        for (let i = 0; i < 4; i++) {
          const gy = -24 - i * 11;
          for (const side of [-1, 1]) {
            ctx.fillStyle = '#FACC15';
            ctx.strokeStyle = outline;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(side * 8, gy, 8, 5, side * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      ctx.fillStyle = '#FB7185';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3.5;
      drawRoundedRect(ctx, 46, 78, 36, 12, 6);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'sugar': {
      // Sparkling pastel cyan sugar crystal cluster
      const shards = [
        { x: 48, y: 74, w: 22, h: 46, r: -0.28, col: '#67E8F9' },
        { x: 78, y: 76, w: 22, h: 44, r: 0.3, col: '#38BDF8' },
        { x: 64, y: 66, w: 28, h: 64, r: 0.02, col: '#A5F3FC' },
      ];
      for (const sh of shards) {
        ctx.save();
        ctx.translate(sh.x, sh.y);
        ctx.rotate(sh.r);
        ctx.beginPath();
        ctx.moveTo(0, -sh.h * 0.65);
        ctx.lineTo(sh.w * 0.5, -sh.h * 0.25);
        ctx.lineTo(sh.w * 0.45, sh.h * 0.45);
        ctx.lineTo(-sh.w * 0.45, sh.h * 0.45);
        ctx.lineTo(-sh.w * 0.5, -sh.h * 0.25);
        ctx.closePath();
        ctx.fillStyle = sh.col;
        ctx.fill();
        ctx.strokeStyle = outline;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.moveTo(0, -sh.h * 0.56);
        ctx.lineTo(sh.w * 0.2, -sh.h * 0.22);
        ctx.lineTo(0, sh.h * 0.3);
        ctx.lineTo(-sh.w * 0.22, -sh.h * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#FFFFFF';
      drawStarShape(ctx, 88, 34, 9, 3, 4);
      ctx.fill();
      break;
    }

    case 'berry': {
      // Plump glossy strawberry
      ctx.beginPath();
      ctx.moveTo(cx, 32);
      ctx.bezierCurveTo(98, 28, 102, 74, cx, 104);
      ctx.bezierCurveTo(26, 74, 30, 28, cx, 32);
      ctx.closePath();
      const g = ctx.createRadialGradient(52, 54, 6, cx, 66, 44);
      g.addColorStop(0, '#FF85A1');
      g.addColorStop(1, '#E11D48');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Seeds
      ctx.fillStyle = '#FEF08A';
      for (const [sx, sy] of [
        [48, 56],
        [64, 52],
        [78, 58],
        [54, 72],
        [70, 74],
        [62, 88],
      ]) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, 2.3, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Leaf cap
      ctx.fillStyle = '#4ADE80';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(42, 34);
      ctx.quadraticCurveTo(64, 18, 86, 34);
      ctx.quadraticCurveTo(72, 42, 64, 38);
      ctx.quadraticCurveTo(54, 42, 42, 34);
      ctx.fill();
      ctx.stroke();

      // Specular shine
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(48, 49, 6, 10, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'milk': {
      // Cute milk bottle
      ctx.beginPath();
      ctx.moveTo(48, 28);
      ctx.lineTo(80, 28);
      ctx.lineTo(82, 46);
      ctx.quadraticCurveTo(96, 56, 94, 92);
      ctx.quadraticCurveTo(94, 104, 64, 104);
      ctx.quadraticCurveTo(34, 104, 34, 92);
      ctx.quadraticCurveTo(32, 56, 46, 46);
      ctx.closePath();
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Milk level inside
      ctx.fillStyle = '#E0F2FE';
      drawRoundedRect(ctx, 40, 62, 48, 36, 12);
      ctx.fill();

      // Cap
      ctx.fillStyle = '#60A5FA';
      drawRoundedRect(ctx, 44, 20, 40, 14, 6);
      ctx.fill();
      ctx.stroke();

      // Label heart
      ctx.fillStyle = '#93C5FD';
      ctx.beginPath();
      ctx.arc(64, 78, 10, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'cacao': {
      // Rich roasted cacao pod
      ctx.save();
      ctx.translate(cx, 66);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, 34, 24, 0, 0, Math.PI * 2);
      const cg = ctx.createLinearGradient(-28, -20, 28, 20);
      cg.addColorStop(0, '#B45309');
      cg.addColorStop(1, '#5C2D16');
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'flour_dough': {
      // Puffy golden-cream dough ball
      ctx.fillStyle = '#FDE68A';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx, 72, 38, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(54, 64, 14, 0.3, 2.2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.ellipse(48, 56, 10, 5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'candy_glass': {
      // Striped shiny candy plate
      ctx.save();
      ctx.translate(cx, 66);
      ctx.rotate(-0.15);
      drawRoundedRect(ctx, -36, -28, 72, 56, 14);
      ctx.fillStyle = '#F472B6';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#FBCFE8';
      for (let x = -60; x < 70; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, -36);
        ctx.lineTo(x + 11, -36);
        ctx.lineTo(x - 10, 36);
        ctx.lineTo(x - 21, 36);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      drawRoundedRect(ctx, -36, -28, 72, 56, 14);
      ctx.stroke();

      // Gloss
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      drawRoundedRect(ctx, -28, -20, 46, 10, 5);
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'whipped_cream': {
      // Swirl of whipped cream
      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      const tiers = [
        { y: 84, rx: 36, ry: 16 },
        { y: 66, rx: 28, ry: 14 },
        { y: 50, rx: 19, ry: 12 },
      ];
      for (const t of tiers) {
        ctx.beginPath();
        ctx.ellipse(cx, t.y, t.rx, t.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(54, 44);
      ctx.quadraticCurveTo(64, 22, 74, 44);
      ctx.fill();
      ctx.stroke();

      // Pink sprinkles
      ctx.fillStyle = '#F472B6';
      for (const [x, y] of [
        [48, 78],
        [76, 74],
        [62, 62],
        [66, 44],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'syrup': {
      // Glowing amber maple syrup bottle
      ctx.beginPath();
      ctx.moveTo(52, 24);
      ctx.lineTo(76, 24);
      ctx.lineTo(80, 44);
      ctx.bezierCurveTo(98, 54, 98, 98, 64, 102);
      ctx.bezierCurveTo(30, 98, 30, 54, 48, 44);
      ctx.closePath();
      const sg = ctx.createLinearGradient(0, 30, 0, 102);
      sg.addColorStop(0, '#FDE047');
      sg.addColorStop(1, '#D97706');
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#78350F';
      drawRoundedRect(ctx, 50, 18, 28, 10, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFBEB';
      drawStarShape(ctx, 64, 72, 11, 5, 5);
      ctx.fill();
      break;
    }

    case 'cookie': {
      // Chocolate chip cookie
      ctx.beginPath();
      ctx.arc(cx, 66, 36, 0, Math.PI * 2);
      const kg = ctx.createRadialGradient(54, 54, 6, cx, 66, 38);
      kg.addColorStop(0, '#F6AD55');
      kg.addColorStop(1, '#C05621');
      ctx.fillStyle = kg;
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#5C2D16';
      for (const [x, y, r] of [
        [48, 54, 5.5],
        [72, 50, 5],
        [62, 68, 6],
        [46, 78, 4.5],
        [78, 76, 5.5],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'berry_tart': {
      // Golden fluted tart crust + cream + berries
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx, 80, 38, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.ellipse(cx, 70, 32, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      for (const [bx, by] of [
        [52, 62],
        [76, 62],
        [64, 54],
      ]) {
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(bx, by, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    case 'choco_wafer': {
      // Wafer block dipped in chocolate
      ctx.save();
      ctx.translate(cx, 66);
      drawRoundedRect(ctx, -34, -26, 68, 52, 10);
      ctx.fillStyle = '#FCD34D';
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2.5;
      for (let i = -20; i <= 20; i += 14) {
        ctx.beginPath();
        ctx.moveTo(i, -24);
        ctx.lineTo(i, 24);
        ctx.stroke();
      }

      // Chocolate glaze top
      ctx.fillStyle = '#6D341B';
      ctx.beginPath();
      ctx.moveTo(-34, -12);
      ctx.lineTo(-34, -20);
      ctx.quadraticCurveTo(-34, -26, -24, -26);
      ctx.lineTo(24, -26);
      ctx.quadraticCurveTo(34, -26, 34, -20);
      ctx.lineTo(34, -2);
      ctx.quadraticCurveTo(18, 8, 6, -4);
      ctx.quadraticCurveTo(-8, 10, -22, -4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'pudding': {
      // Jiggly custard pudding with caramel cap
      ctx.beginPath();
      ctx.moveTo(32, 92);
      ctx.lineTo(42, 44);
      ctx.quadraticCurveTo(64, 34, 86, 44);
      ctx.lineTo(96, 92);
      ctx.quadraticCurveTo(64, 104, 32, 92);
      ctx.closePath();
      ctx.fillStyle = '#FDE047';
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Caramel top
      ctx.beginPath();
      ctx.moveTo(41, 46);
      ctx.quadraticCurveTo(64, 34, 87, 46);
      ctx.quadraticCurveTo(80, 62, 68, 54);
      ctx.quadraticCurveTo(56, 66, 41, 46);
      ctx.fillStyle = '#9A3412';
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'tapioca_tea': {
      // Pastel lavender boba cup with straw & pearls
      ctx.fillStyle = '#DDD6FE';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(40, 44);
      ctx.lineTo(88, 44);
      ctx.lineTo(80, 100);
      ctx.lineTo(48, 100);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Boba pearls at bottom
      ctx.fillStyle = '#312E81';
      for (const [bx, by] of [
        [54, 92],
        [64, 93],
        [74, 92],
        [59, 85],
        [69, 85],
      ]) {
        ctx.beginPath();
        ctx.arc(bx, by, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lid & Straw
      ctx.fillStyle = '#F472B6';
      drawRoundedRect(ctx, 36, 36, 56, 12, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      drawRoundedRect(ctx, 64, 14, 10, 24, 3);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'shortcake': {
      // Slice of fluffy strawberry shortcake
      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(28, 92);
      ctx.lineTo(96, 92);
      ctx.lineTo(96, 54);
      ctx.lineTo(36, 52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sponge & jam stripes
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(36, 62, 56, 8);
      ctx.fillStyle = '#FB7185';
      ctx.fillRect(36, 72, 56, 7);
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(36, 80, 56, 8);

      // Re-stroke cleanly
      ctx.strokeRect(32, 54, 64, 38);

      // Strawberry on top
      ctx.fillStyle = '#E11D48';
      ctx.beginPath();
      ctx.arc(64, 42, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.ellipse(64, 30, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'pancake_tower': {
      // Towering stack of golden pancakes + butter + syrup
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 5; i++) {
        const y = 92 - i * 11;
        ctx.fillStyle = i % 2 === 0 ? '#F59E0B' : '#FBBF24';
        ctx.beginPath();
        ctx.ellipse(cx, y, 36 - i * 1.5, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // Butter pat
      ctx.fillStyle = '#FEF08A';
      drawRoundedRect(ctx, 52, 34, 24, 14, 4);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'star_engine_core': {
      // Radiant cyan & golden star rocket part core
      const glow = ctx.createRadialGradient(cx, 64, 6, cx, 64, 42);
      glow.addColorStop(0, '#FFFFFF');
      glow.addColorStop(0.45, '#38BDF8');
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, 64, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FDE047';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      drawStarShape(ctx, cx, 64, 32, 16, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(cx, 64, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'sugar_alloy_hull': {
      // Metallic pink honeycomb composite armor plate
      ctx.save();
      ctx.translate(cx, 64);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * 40;
        const py = Math.sin(a) * 40;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const hg = ctx.createLinearGradient(-34, -34, 34, 34);
      hg.addColorStop(0, '#FBCFE8');
      hg.addColorStop(0.5, '#F472B6');
      hg.addColorStop(1, '#BE185D');
      ctx.fillStyle = hg;
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Inner honeycomb plate & cyan rivets
      ctx.strokeStyle = '#FFF1F2';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * 24;
        const py = Math.sin(a) * 24;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 30, Math.sin(a) * 30, 3.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    case 'macaron_cpu': {
      // Pastel macaron logic board with golden circuit traces
      ctx.save();
      ctx.translate(cx, 64);
      drawRoundedRect(ctx, -38, -38, 76, 76, 14);
      ctx.fillStyle = '#34D399';
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Golden PCB traces
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 3;
      for (const p of [-20, 0, 20]) {
        ctx.beginPath();
        ctx.moveTo(-34, p);
        ctx.lineTo(34, p);
        ctx.moveTo(p, -34);
        ctx.lineTo(p, 34);
        ctx.stroke();
      }

      // Cute pastel purple macaron processor in center
      ctx.fillStyle = '#A78BFA';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(0, 4, 24, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#DDD6FE';
      ctx.beginPath();
      ctx.ellipse(0, -4, 24, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'golden_parfait_satellite': {
      // Solar-winged golden parfait space satellite
      ctx.save();
      ctx.translate(cx, 64);

      // Left & right blue solar wings
      ctx.fillStyle = '#38BDF8';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3.5;
      drawRoundedRect(ctx, -54, -14, 30, 28, 5);
      ctx.fill();
      ctx.stroke();
      drawRoundedRect(ctx, 24, -14, 30, 28, 5);
      ctx.fill();
      ctx.stroke();

      // Solar grid lines
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 2;
      for (const sx of [-44, -34, 34, 44]) {
        ctx.beginPath();
        ctx.moveTo(sx, -12);
        ctx.lineTo(sx, 12);
        ctx.stroke();
      }

      // Golden parfait chalice body
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-22, -16);
      ctx.lineTo(22, -16);
      ctx.lineTo(14, 28);
      ctx.lineTo(-14, 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cream & strawberry antenna dome
      ctx.fillStyle = '#FFFDF9';
      ctx.beginPath();
      ctx.arc(0, -18, 18, Math.PI, 0);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#E11D48';
      ctx.beginPath();
      ctx.arc(0, -34, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    }
  }

  ctx.restore();
  return c;
}

export function createSpriteBank(): SpriteBank {
  const items = {} as Record<ItemId, HTMLCanvasElement>;
  const itemDataUrls = {} as Record<ItemId, string>;

  for (const def of ITEM_LIST) {
    const canvas = paintItemSprite(def.id, 128);
    items[def.id] = canvas;
    itemDataUrls[def.id] = canvas.toDataURL('image/png');
  }

  return { items, itemDataUrls };
}
