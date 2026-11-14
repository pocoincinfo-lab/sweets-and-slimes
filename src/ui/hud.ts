import { BUILDING_LIST, BUILDINGS } from '../data/buildings';
import { ITEMS, SLIME_DEFS } from '../data/items';
import { RECIPES, RECIPES_BY_MACHINE } from '../data/recipes';
import { ROCKET_PHASES } from '../data/rocket';
import {
  computePowerStats,
  demolishAt,
  getItemsPerMinute,
} from '../core/simulation';
import { MAP_SIZE, inBounds } from '../core/world';
import { LoadedAssets } from '../render/assetLoader';
import { SpriteBank } from '../render/spriteBake';
import { BuildingType, GameState, ItemId, SlimeType } from '../types/game';

export interface HudCallbacks {
  onSelectTool: (tool: BuildingType | 'demolish' | 'inspect') => void;
  onRotate: () => void;
  onCenterSilo: () => void;
  onJumpCamera: (x: number, y: number) => void;
  onRushWave: () => void;
  onTogglePeaceful: () => void;
  onDemoAdvancePhase: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onCycleSpeed: () => void;
  onSave: () => void;
  onReset: () => void;
  onDismissVictory: () => void;
  onSelectRecipe: (buildingId: string, recipeId: string | null) => void;
  onCloseInspect: () => void;
}

const DIR_LABELS = ['北 ↑', '東 →', '南 ↓', '西 ←'];
const DIR_ARROWS = ['↑', '→', '↓', '←'];

const RESOURCE_INFO: Record<string, { name: string; emoji: string }> = {
  wheat: { name: '黄金小麦畑', emoji: '🌾' },
  sugar: { name: 'シュガークリスタル鉱脈', emoji: '💎' },
  berry: { name: 'スイートベリー畑', emoji: '🍓' },
  milk: { name: 'フレッシュミルクの泉', emoji: '🥛' },
  cacao: { name: '香ばしカカオの森', emoji: '🍫' },
};

const BUILDING_EMOJI: Record<BuildingType, string> = {
  belt: '➡️',
  express_belt: '🌈',
  splitter: '🔀',
  tunnel: '🚇',
  harvester: '⛏️',
  oven: '🔥',
  mixer: '🥣',
  patisserie: '🧁',
  confectioner: '🏰',
  cannon: '🎯',
  gatling_cannon: '💥',
  sugar_windmill: '🎡',
};

export class GameHud {
  private root: HTMLElement;
  private sprites: SpriteBank;
  private assets: LoadedAssets;
  private cb: HudCallbacks;

  private encyclopediaOpen = false;
  private encyclopediaTab: 'recipes' | 'slimes' = 'recipes';
  private welcomeOpen = true;
  private lastSideSignature = '';
  private lastRocketSignature = '';
  private lastStatsSignature = '';
  private currentRocketPhase = 1;
  private uiHoverActive = false;
  private popoverSource: 'none' | 'ui' | 'world' = 'none';

  // Cached DOM references
  private rocketCardEl!: HTMLElement;
  private statsBarEl!: HTMLElement;
  private btnPeaceful!: HTMLButtonElement;
  private btnMute!: HTMLButtonElement;
  private btnPause!: HTMLButtonElement;
  private btnSpeed!: HTMLButtonElement;
  private btnEncyc!: HTMLButtonElement;
  private btnDemo!: HTMLButtonElement;
  private countdownEl!: HTMLElement;
  private sidePanelEl!: HTMLElement;
  private minimapCanvasEl!: HTMLCanvasElement;
  private minimapBodyEl!: HTMLElement;
  private minimapToggleEl!: HTMLButtonElement;
  private minimapOpen = true;
  private bottomDockEl!: HTMLElement;
  private hoverPopoverEl!: HTMLElement;
  private welcomeModalEl!: HTMLElement;
  private victoryModalEl!: HTMLElement;
  private victoryStatsEl!: HTMLElement;

  constructor(
    root: HTMLElement,
    sprites: SpriteBank,
    assets: LoadedAssets,
    callbacks: HudCallbacks
  ) {
    this.root = root;
    this.sprites = sprites;
    this.assets = assets;
    this.cb = callbacks;
    this.buildDom();
  }

  private buildDom(): void {
    this.root.innerHTML = `
      <div class="top-hud">
        <div class="glass-panel rocket-card" id="rocket-card"></div>
        <div class="glass-panel stats-bar" id="stats-bar"></div>
        <div class="glass-panel actions-bar" id="actions-bar">
          <button class="btn btn-icon btn-pink" id="btn-rush" data-tip-kind="ui" data-tip-title="🍮 おかわりウェーブ" data-tip-desc="今すぐスライムを呼び寄せてキラキラ星とコインを稼ぎます。">🍮</button>
          <button class="btn btn-icon" id="btn-peaceful" data-tip-kind="ui" data-tip-title="🕊️ 平和モード切替" data-tip-desc="スライムの自動来訪を止めて、自分のペースで工場を組み立てられます。">🕊️</button>
          <button class="btn btn-icon" id="btn-speed" data-tip-kind="ui" data-tip-title="⏩ ゲーム速度切替" data-tip-desc="工場の稼働スピードを 1x / 2x / 5x で切り替えます。">⏩ 1x</button>
          <button class="btn btn-icon" id="btn-pause" data-tip-kind="ui" data-tip-title="⏸️ 一時停止 / 再開" data-tip-desc="工場とスライムを一時停止します（スペースキーでも切替）。">⏸️</button>
          <button class="btn btn-icon" id="btn-encyc" data-tip-kind="ui" data-tip-title="📖 お菓子＆スライム図鑑" data-tip-desc="全15種類のレシピとスライムの特徴・報酬を確認できます。">📖</button>
          <button class="btn btn-icon" id="btn-mute" data-tip-kind="ui" data-tip-title="🔊 効果音 ON / OFF" data-tip-desc="クリック音や効果音のミュートを切り替えます。">🔊</button>
          <button class="btn btn-icon btn-amber" id="btn-demo" data-tip-kind="ui" data-tip-title="🚀 次Phaseへスキップ（テスト用）" data-tip-desc="現在のフェーズ要求を即座に満たし、次のフェーズへ進みます。">🚀</button>
          <button class="btn btn-icon" id="btn-save" data-tip-kind="ui" data-tip-title="💾 手動セーブ" data-tip-desc="現在の工場データをブラウザへ保存します。">💾</button>
          <button class="btn btn-icon" id="btn-reset" data-tip-kind="ui" data-tip-title="🔄 最初からやり直す" data-tip-desc="セーブデータを削除して新しいお菓子惑星でスタートします。">🔄</button>
          <button class="btn btn-icon" id="btn-help" data-tip-kind="ui" data-tip-title="❓ 遊び方ガイド" data-tip-desc="基本操作とロケット発射までの遊び方を表示します。">❓</button>
        </div>
      </div>

      <div class="countdown-banner hidden" id="countdown-banner"></div>

      <div class="middle-area">
        <div class="glass-panel minimap-card" id="minimap-card" data-tip-kind="ui" data-tip-title="🍓 スイーツマップ (80×80)" data-tip-desc="クリック・ドラッグでカメラを即座に移動できます。🚀基地 / 🟨🌾資源 / 🟧🏭工場 / 🌸🍮スライム">
          <div class="minimap-header">
            <span>🍓 スイーツマップ</span>
            <button class="minimap-toggle" id="minimap-toggle">−</button>
          </div>
          <div class="minimap-body" id="minimap-body">
            <canvas id="minimap-canvas" width="156" height="156"></canvas>
          </div>
        </div>
        <div class="glass-panel side-panel hidden" id="side-panel"></div>
      </div>

      <div class="bottom-wrap">
        <div class="glass-panel bottom-dock" id="bottom-dock"></div>
      </div>

      <div class="hover-popover hidden" id="hover-popover"></div>

      <div class="modal-backdrop" id="welcome-modal">
        <div class="modal-card">
          <img class="modal-banner" src="${this.assets.titleBannerUrl}" alt="Sweets & Slimes" />
          <h1 class="modal-title">🍰 Sweets &amp; Slimes 〜スイーツ・ロケット発射計画〜</h1>
          <div class="modal-grid">
            <div class="modal-step">
              <strong>1. 神視点でらくらく建設</strong><br />
              WASD / 右ドラッグでマップ移動、ホイールでズーム。ベルトは左ドラッグで自動L字カーブ敷設！
            </div>
            <div class="modal-step">
              <strong>2. 🪙コイン＆✨星のサイクル</strong><br />
              施設の建設には<strong>おやつコイン🪙</strong>（納品・生産・基礎収入で増加）を使用！キャノンでスライムを満腹にして<strong>キラキラ星✨</strong>を集め、ロケットPhaseを進めよう！
            </div>
            <div class="modal-step">
              <strong>3. 本格8段階・巨大工場へ！</strong><br />
              5階層の本格お菓子工場を組み上げ、8段階を経て「ロケットパーツ100基＆黄金パフェ衛星」を宇宙へ打ち上げよう！
            </div>
          </div>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button class="btn btn-pink" id="btn-start-game" style="font-size:16px; padding:11px 28px;">
              🎂 工場づくりをはじめる！
            </button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop hidden" id="victory-modal">
        <div class="modal-card">
          <img class="modal-banner" src="${this.assets.titleBannerUrl}" alt="Launch Success" />
          <div class="modal-badges">
            <img src="${this.assets.rocketEmblemUrl}" alt="Rocket Emblem" />
            <img src="${this.assets.kingSlimeBadgeUrl}" alt="King Slime" />
          </div>
          <h1 class="modal-title">🚀 スイーツ・ロケット打ち上げ大成功！！</h1>
          <p style="margin:0; font-size:14px; font-weight:700; color:#6b3e57;">
            甘くて幸せな綿あめジェットと共に、特製スイーツ・ロケットが宇宙へ旅立ちました！
            お見送りしてくれた満腹スライムたちも大満足です♡
          </p>
          <div class="modal-grid" id="victory-stats"></div>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button class="btn btn-mint" id="btn-continue-playing" style="font-size:14px; padding:10px 22px;">
              🏭 この工場のまま遊ぶ
            </button>
            <button class="btn btn-pink" id="btn-new-planet" style="font-size:14px; padding:10px 22px;">
              🔄 新しい惑星でやり直す
            </button>
          </div>
        </div>
      </div>
    `;

    this.rocketCardEl = this.root.querySelector('#rocket-card')!;
    this.statsBarEl = this.root.querySelector('#stats-bar')!;
    this.btnPeaceful = this.root.querySelector('#btn-peaceful')!;
    this.btnMute = this.root.querySelector('#btn-mute')!;
    this.btnPause = this.root.querySelector('#btn-pause')!;
    this.btnSpeed = this.root.querySelector('#btn-speed')!;
    this.btnEncyc = this.root.querySelector('#btn-encyc')!;
    this.btnDemo = this.root.querySelector('#btn-demo')!;
    this.countdownEl = this.root.querySelector('#countdown-banner')!;
    this.sidePanelEl = this.root.querySelector('#side-panel')!;
    this.minimapCanvasEl = this.root.querySelector('#minimap-canvas')!;
    this.minimapBodyEl = this.root.querySelector('#minimap-body')!;
    this.minimapToggleEl = this.root.querySelector('#minimap-toggle')!;
    this.bottomDockEl = this.root.querySelector('#bottom-dock')!;
    this.hoverPopoverEl = this.root.querySelector('#hover-popover')!;
    this.welcomeModalEl = this.root.querySelector('#welcome-modal')!;
    this.victoryModalEl = this.root.querySelector('#victory-modal')!;
    this.victoryStatsEl = this.root.querySelector('#victory-stats')!;

    this.root.querySelector('#btn-rush')!.addEventListener('click', () => this.cb.onRushWave());
    this.btnPeaceful.addEventListener('click', () => this.cb.onTogglePeaceful());
    this.btnDemo.addEventListener('click', () => this.cb.onDemoAdvancePhase());
    this.btnMute.addEventListener('click', () => this.cb.onToggleMute());
    this.btnPause.addEventListener('click', () => this.cb.onTogglePause());
    this.btnSpeed.addEventListener('click', () => this.cb.onCycleSpeed());
    this.btnEncyc.addEventListener('click', () => {
      this.encyclopediaOpen = !this.encyclopediaOpen;
      this.lastSideSignature = '';
    });
    this.root.querySelector('#btn-save')!.addEventListener('click', () => this.cb.onSave());
    this.root.querySelector('#btn-reset')!.addEventListener('click', () => this.cb.onReset());
    this.root.querySelector('#btn-help')!.addEventListener('click', () => {
      this.welcomeOpen = true;
      this.welcomeModalEl.classList.remove('hidden');
    });
    this.root.querySelector('#btn-start-game')!.addEventListener('click', () => {
      this.welcomeOpen = false;
      this.welcomeModalEl.classList.add('hidden');
    });
    this.root.querySelector('#btn-continue-playing')!.addEventListener('click', () => {
      this.cb.onDismissVictory();
      this.victoryModalEl.classList.add('hidden');
    });
    this.root.querySelector('#btn-new-planet')!.addEventListener('click', () => {
      this.victoryModalEl.classList.add('hidden');
      this.cb.onReset();
    });

    this.minimapToggleEl.addEventListener('click', () => {
      this.minimapOpen = !this.minimapOpen;
      this.minimapBodyEl.classList.toggle('hidden', !this.minimapOpen);
      this.minimapToggleEl.textContent = this.minimapOpen ? '−' : '＋';
    });

    let minimapDragging = false;
    const jumpFromEvent = (e: PointerEvent): void => {
      const rect = this.minimapCanvasEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      this.cb.onJumpCamera(nx * MAP_SIZE, ny * MAP_SIZE);
    };
    this.minimapCanvasEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      minimapDragging = true;
      this.minimapCanvasEl.setPointerCapture(e.pointerId);
      jumpFromEvent(e);
    });
    this.minimapCanvasEl.addEventListener('pointermove', (e) => {
      if (!minimapDragging) return;
      jumpFromEvent(e);
    });
    const endMiniDrag = (): void => {
      minimapDragging = false;
    };
    this.minimapCanvasEl.addEventListener('pointerup', endMiniDrag);
    this.minimapCanvasEl.addEventListener('pointercancel', endMiniDrag);

    this.bindHoverPopover();
    this.buildBottomDock();
  }

  private bindHoverPopover(): void {
    this.root.addEventListener('mouseover', (e) => {
      const tipEl = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip-kind]');
      if (tipEl) {
        this.uiHoverActive = true;
        this.showPopoverForUi(tipEl);
      }
    });
    this.root.addEventListener('mousemove', (e) => {
      const tipEl = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip-kind]');
      if (tipEl) {
        this.uiHoverActive = true;
        this.showPopoverForUi(tipEl);
      } else if (this.uiHoverActive) {
        this.uiHoverActive = false;
        if (this.popoverSource === 'ui') this.hidePopover();
      }
    });
    this.root.addEventListener('mouseout', (e) => {
      const fromTip = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip-kind]');
      const toTip = (e.relatedTarget as HTMLElement | null)?.closest<HTMLElement>('[data-tip-kind]');
      if (fromTip && !toTip) {
        this.uiHoverActive = false;
        if (this.popoverSource === 'ui') this.hidePopover();
      }
    });
  }

  clearUiHover(): void {
    if (this.uiHoverActive) {
      this.uiHoverActive = false;
      if (this.popoverSource === 'ui') this.hidePopover();
    }
  }

  private hidePopover(): void {
    this.popoverSource = 'none';
    this.hoverPopoverEl.classList.add('hidden');
  }

  private positionPopover(html: string, source: 'ui' | 'world', anchorRect?: DOMRect, cx = 0, cy = 0): void {
    this.popoverSource = source;
    this.hoverPopoverEl.innerHTML = html;
    this.hoverPopoverEl.classList.remove('hidden');

    const pw = this.hoverPopoverEl.offsetWidth || 240;
    const ph = this.hoverPopoverEl.offsetHeight || 100;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = 12;
    let top = 12;

    if (anchorRect) {
      left = Math.max(10, Math.min(vw - pw - 10, anchorRect.left + anchorRect.width / 2 - pw / 2));
      if (anchorRect.top > vh * 0.52) {
        top = Math.max(8, anchorRect.top - ph - 10);
      } else {
        top = Math.min(vh - ph - 10, anchorRect.bottom + 8);
      }
    } else {
      left = cx + 18 + pw > vw ? Math.max(10, cx - pw - 14) : cx + 18;
      top = cy + 18 + ph > vh ? Math.max(10, cy - ph - 14) : cy + 18;
    }

    this.hoverPopoverEl.style.left = `${Math.round(left)}px`;
    this.hoverPopoverEl.style.top = `${Math.round(top)}px`;
  }

  private renderRecipeRowHtml(inputs: Partial<Record<ItemId, number>>, output: ItemId): string {
    const ins = Object.entries(inputs)
      .map(([id, qty]) => `<img src="${this.sprites.itemDataUrls[id as ItemId]}" alt="" />×${qty}`)
      .join('+');
    return `
      <div class="pop-recipe-row">
        ${ins} <span>→</span>
        <img src="${this.sprites.itemDataUrls[output]}" alt="" />
        <span>${ITEMS[output].shortName}</span>
      </div>
    `;
  }

  private showPopoverForUi(el: HTMLElement): void {
    const kind = el.dataset.tipKind;
    const rect = el.getBoundingClientRect();

    if (kind === 'tool') {
      const toolType = el.dataset.tipTool as BuildingType;
      const def = BUILDINGS[toolType];
      if (!def) return;
      const locked = def.unlockPhase > this.currentRocketPhase;
      const badge = locked ? `🔒 Phase ${def.unlockPhase}解放` : `🪙 ${def.costCoins}`;
      const powerText =
        def.powerSupply > 0
          ? `⚡ 発電 +${def.powerSupply}`
          : def.powerDemand > 0
            ? `⚡ 消費 -${def.powerDemand}`
            : '⚡ 電力不要';
      const recipes = RECIPES_BY_MACHINE[def.type];
      const recipesHtml =
        recipes && recipes.length > 0
          ? `<div class="pop-recipes">${recipes
              .slice(0, 4)
              .map((r) => this.renderRecipeRowHtml(r.inputs, r.output))
              .join('')}${recipes.length > 4 ? `<div class="pop-desc">…ほか全${recipes.length}レシピ（図鑑で確認）</div>` : ''}</div>`
          : '';
      this.positionPopover(
        `
          <div class="pop-header">
            <span class="pop-title">${BUILDING_EMOJI[def.type]} ${def.name}</span>
            <span class="pop-badge">${badge}</span>
          </div>
          <div class="pop-meta"><span>${powerText}</span><span>キー: ${def.hotkey}</span></div>
          <div class="pop-desc">${def.description}</div>
          ${recipesHtml}
        `,
        'ui',
        rect
      );
      return;
    }

    if (kind === 'item') {
      const iid = el.dataset.tipItem as ItemId;
      const item = ITEMS[iid];
      if (!item) return;
      const rec = RECIPES.find((r) => r.output === iid);
      const recHtml = rec
        ? `<div class="pop-recipes">
            <div class="pop-desc"><strong>作成:</strong> ${BUILDINGS[rec.machine].name} (${rec.durationSec}s)</div>
            ${this.renderRecipeRowHtml(rec.inputs, rec.output)}
          </div>`
        : `<div class="pop-recipes"><div class="pop-desc">資源フィールド上に採掘機⛏️を置いて収穫</div></div>`;
      this.positionPopover(
        `
          <div class="pop-header">
            <span class="pop-title">${item.name}</span>
            <span class="pop-badge">${item.calories}kcal</span>
          </div>
          <div class="pop-desc">${item.description}</div>
          ${recHtml}
        `,
        'ui',
        rect
      );
      return;
    }

    if (kind === 'stat') {
      const id = el.dataset.tipId;
      const st = this.latestState;
      if (id === 'coins') {
        this.positionPopover(
          `
            <div class="pop-header">
              <span class="pop-title">🪙 おやつコイン</span>
              <span class="pop-badge">${st ? Math.floor(st.coins) : 0}枚</span>
            </div>
            <div class="pop-desc">すべての施設・ベルトの建設資金です（撤去時は100%返金）。発射台への納品・お菓子の生産・スライム満腹・毎秒+2の基礎収入で増えます。</div>
          `,
          'ui',
          rect
        );
      } else if (id === 'stars') {
        this.positionPopover(
          `
            <div class="pop-header">
              <span class="pop-title">✨ キラキラ星</span>
              <span class="pop-badge">${st ? st.starSugar : 0}個</span>
            </div>
            <div class="pop-desc">ロケットPhaseの進化専用ポイント！満腹になって帰ったスライムがお礼に落とします。（累計獲得: ${st?.stats.starsEarned ?? 0}✨ / 満腹: ${st?.stats.slimesFed ?? 0}匹）</div>
          `,
          'ui',
          rect
        );
      } else if (id === 'power' && st) {
        const power = computePowerStats(st);
        const pct = Math.round(power.ratio * 100);
        const ipm = getItemsPerMinute(st);
        this.positionPopover(
          `
            <div class="pop-header">
              <span class="pop-title">⚡ 工場電力 ＆ 生産効率</span>
              <span class="pop-badge">${pct}%</span>
            </div>
            <div class="pop-meta"><span>発電 ${power.supply} / 消費 ${power.demand}</span><span>📦 ${ipm}個/分</span></div>
            <div class="pop-desc">風車発電機🎡を増やすと生産＆砲台連射が100%で稼働します。</div>
          `,
          'ui',
          rect
        );
      }
      return;
    }

    if (kind === 'rocket' && this.latestState) {
      const pReq = ROCKET_PHASES[Math.min(this.latestState.rocket.phase, ROCKET_PHASES.length) - 1];
      if (!pReq) return;
      this.positionPopover(
        `
          <div class="pop-header">
            <span class="pop-title">🚀 ${pReq.title}</span>
            <span class="pop-badge">Phase ${pReq.phase}/${ROCKET_PHASES.length}</span>
          </div>
          <div class="pop-desc">${pReq.description}</div>
        `,
        'ui',
        rect
      );
      return;
    }

    const title = el.dataset.tipTitle || '';
    const desc = el.dataset.tipDesc || '';
    const badge = el.dataset.tipBadge || '';
    if (!title) return;
    this.positionPopover(
      `
        <div class="pop-header">
          <span class="pop-title">${title}</span>
          ${badge ? `<span class="pop-badge">${badge}</span>` : ''}
        </div>
        ${desc ? `<div class="pop-desc">${desc}</div>` : ''}
      `,
      'ui',
      rect
    );
  }

  private latestState: GameState | null = null;

  updateWorldHover(
    state: GameState,
    tilePos: { x: number; y: number } | null,
    clientX: number,
    clientY: number,
    suppressed: boolean
  ): void {
    this.latestState = state;
    if (suppressed || this.encyclopediaOpen) {
      if (this.popoverSource === 'world') this.hidePopover();
      return;
    }
    if (this.uiHoverActive) return;

    if (!tilePos || !inBounds(tilePos.x, tilePos.y)) {
      if (this.popoverSource === 'world') this.hidePopover();
      return;
    }

    const tile = state.tiles[tilePos.y][tilePos.x];
    if (tile.isRocketSilo) {
      const pReq = ROCKET_PHASES[Math.min(state.rocket.phase, ROCKET_PHASES.length) - 1];
      const chips = Object.entries(pReq.requiredItems)
        .map(([id, need]) => {
          const iid = id as ItemId;
          const have = state.rocket.delivered[iid] ?? 0;
          return `<img src="${this.sprites.itemDataUrls[iid]}" alt="" /><span>${Math.min(have, need ?? 0)}/${need}</span>`;
        })
        .join(' ');
      this.positionPopover(
        `
          <div class="pop-header">
            <span class="pop-title">🚀 スイーツ発射台</span>
            <span class="pop-badge">Phase ${state.rocket.phase}/${ROCKET_PHASES.length}</span>
          </div>
          <div class="pop-desc">${pReq.partName} — ベルトを直接接続して納品！（余剰品はコインに自動換金🪙）</div>
          <div class="pop-recipes"><div class="pop-recipe-row">${chips}</div></div>
        `,
        'world',
        undefined,
        clientX,
        clientY
      );
      return;
    }

    if (tile.buildingId && state.buildings[tile.buildingId]) {
      const b = state.buildings[tile.buildingId];
      const def = BUILDINGS[b.type];
      const inItems = Object.entries(b.inputBuffer)
        .filter(([, q]) => (q ?? 0) > 0)
        .map(([id, q]) => `<img src="${this.sprites.itemDataUrls[id as ItemId]}" alt="" />×${q}`)
        .join(' ');
      const ammoItems = Object.entries(b.ammoBuffer)
        .filter(([, q]) => (q ?? 0) > 0)
        .map(([id, q]) => `<img src="${this.sprites.itemDataUrls[id as ItemId]}" alt="" />×${q}`)
        .join(' ');
      const activeRec = b.activeRecipeId ? RECIPES.find((r) => r.id === b.activeRecipeId) : null;
      const statusHtml = activeRec
        ? `<div class="pop-meta"><span>レシピ: ${activeRec.name}</span><span>累計: ${b.totalCrafted}</span></div>`
        : `<div class="pop-meta"><span>向き: ${DIR_LABELS[b.dir]}</span>${b.totalCrafted > 0 ? `<span>累計: ${b.totalCrafted}</span>` : ''}</div>`;
      const bufHtml =
        inItems || ammoItems
          ? `<div class="pop-recipes"><div class="pop-recipe-row">${inItems || ammoItems}</div></div>`
          : '';
      this.positionPopover(
        `
          <div class="pop-header">
            <span class="pop-title">${BUILDING_EMOJI[b.type]} ${def.name}</span>
            <span class="pop-badge">${DIR_ARROWS[b.dir]}</span>
          </div>
          ${statusHtml}
          <div class="pop-desc">${def.description}</div>
          ${bufHtml}
        `,
        'world',
        undefined,
        clientX,
        clientY
      );
      return;
    }

    if (tile.resource) {
      const info = RESOURCE_INFO[tile.resource];
      this.positionPopover(
        `
          <div class="pop-header">
            <span class="pop-title">${info?.emoji ?? '✨'} ${info?.name ?? tile.resource}</span>
            <span class="pop-badge">資源</span>
          </div>
          <div class="pop-desc">ここに採掘機⛏️（🪙25）を配置すると自動で収穫します。</div>
        `,
        'world',
        undefined,
        clientX,
        clientY
      );
      return;
    }

    if (this.popoverSource === 'world') {
      this.hidePopover();
    }
  }

  getMinimapCanvas(): HTMLCanvasElement | null {
    return this.minimapOpen ? this.minimapCanvasEl : null;
  }

  private buildBottomDock(): void {
    this.bottomDockEl.innerHTML = '';

    const dividerBefore = new Set<BuildingType>(['harvester', 'cannon']);
    for (const def of BUILDING_LIST) {
      if (dividerBefore.has(def.type)) {
        const div = document.createElement('div');
        div.className = 'dock-divider';
        this.bottomDockEl.appendChild(div);
      }

      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.dataset.tool = def.type;
      btn.dataset.tipKind = 'tool';
      btn.dataset.tipTool = def.type;
      const emoji = BUILDING_EMOJI[def.type] ?? '✨';
      btn.innerHTML = `
        <span class="tool-hotkey">${def.hotkey}</span>
        <span class="tool-icon" style="background:${def.accentColor}26">${emoji}</span>
        <span class="tool-cost">🪙${def.costCoins}</span>
      `;
      btn.addEventListener('click', () => this.cb.onSelectTool(def.type));
      this.bottomDockEl.appendChild(btn);
    }

    const actionDivider = document.createElement('div');
    actionDivider.className = 'dock-divider';
    this.bottomDockEl.appendChild(actionDivider);

    const extras: Array<{
      id: 'inspect' | 'demolish' | 'rotate' | 'center';
      title: string;
      desc: string;
      key: string;
      swatch: string;
      emoji: string;
    }> = [
      { id: 'inspect', title: '🔍 機械・レシピ確認', desc: '配置した機械をクリックして生産状況の確認や固定レシピの設定を行います。', key: 'Q', swatch: '#38BDF8', emoji: '🔍' },
      { id: 'rotate', title: '🔄 建設向きの回転', desc: '次に配置するベルトや機械の向きを90°回転させます（Rキー）。', key: 'R', swatch: '#FBBF24', emoji: '🔄' },
      { id: 'demolish', title: '🗑️ 施設の撤去', desc: '左クリック/ドラッグで施設を撤去します（建設コインは100%返金）。', key: 'X', swatch: '#F43F5E', emoji: '🗑️' },
      { id: 'center', title: '🚀 発射台へ移動', desc: 'マップ中央のスイーツ発射台へカメラを戻します（Hキー）。', key: 'H', swatch: '#F472B6', emoji: '🚀' },
    ];

    for (const ex of extras) {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      if (ex.id === 'inspect' || ex.id === 'demolish') {
        btn.dataset.tool = ex.id;
      }
      btn.dataset.tipKind = 'ui';
      btn.dataset.tipTitle = ex.title;
      btn.dataset.tipDesc = ex.desc;
      btn.dataset.tipBadge = `キー: ${ex.key}`;
      const costText = ex.id === 'rotate' ? `<span class="tool-cost" id="btn-rotate-dir">${DIR_ARROWS[1]}</span>` : `<span class="tool-cost"></span>`;
      btn.innerHTML = `
        <span class="tool-hotkey">${ex.key}</span>
        <span class="tool-icon" style="background:${ex.swatch}26">${ex.emoji}</span>
        ${costText}
      `;
      btn.addEventListener('click', () => {
        if (ex.id === 'rotate') this.cb.onRotate();
        else if (ex.id === 'center') this.cb.onCenterSilo();
        else this.cb.onSelectTool(ex.id);
      });
      this.bottomDockEl.appendChild(btn);
    }
  }

  hideWelcome(): void {
    this.welcomeOpen = false;
    this.welcomeModalEl.classList.add('hidden');
  }

  isWelcomeOpen(): boolean {
    return this.welcomeOpen;
  }

  sync(state: GameState): void {
    this.latestState = state;
    this.currentRocketPhase = state.rocket.phase;

    // 1. Rocket progress card (icon-only requirement chips; details in hover popover)
    const phaseReq = ROCKET_PHASES[Math.min(state.rocket.phase, ROCKET_PHASES.length) - 1];
    const reqSig = phaseReq
      ? Object.keys(phaseReq.requiredItems)
          .map((id) => `${id}:${state.rocket.delivered[id as ItemId] ?? 0}`)
          .join(',')
      : '';
    const rocketSig = `${state.rocket.launched}|${state.rocket.launching}|${state.rocket.phase}|${state.starSugar}|${reqSig}`;
    if (rocketSig !== this.lastRocketSignature) {
      this.lastRocketSignature = rocketSig;
      let chipsHtml = '';
      if (state.rocket.launched) {
        chipsHtml = `<span class="req-chip done">🚀 打ち上げ成功！</span>`;
      } else if (state.rocket.launching) {
        chipsHtml = `<span class="req-chip">🔥 点火カウントダウン中！</span>`;
      } else if (phaseReq) {
        for (const [id, need] of Object.entries(phaseReq.requiredItems)) {
          const iid = id as ItemId;
          const have = state.rocket.delivered[iid] ?? 0;
          const done = have >= (need ?? 0);
          chipsHtml += `
            <span class="req-chip ${done ? 'done' : ''}" data-tip-kind="item" data-tip-item="${iid}">
              <img src="${this.sprites.itemDataUrls[iid]}" alt="${ITEMS[iid].shortName}" />
              ${Math.min(have, need ?? 0)}/${need}
            </span>
          `;
        }
        const starDone = state.starSugar >= phaseReq.requiredStars;
        chipsHtml += `
          <span class="req-chip ${starDone ? 'done' : ''}" data-tip-kind="stat" data-tip-id="stars">
            ✨ ${Math.min(state.starSugar, phaseReq.requiredStars)}/${phaseReq.requiredStars}
          </span>
        `;
      }

      this.rocketCardEl.innerHTML = `
        <img class="rocket-thumb" src="${this.assets.rocketEmblemUrl}" alt="Rocket" />
        <div class="rocket-info">
          <div class="rocket-title-row" data-tip-kind="rocket">
            <span class="phase-badge">${state.rocket.launched ? 'COMPLETE' : `Phase ${state.rocket.phase}/${ROCKET_PHASES.length}`}</span>
            <span>${state.rocket.launched ? '発射完了！' : phaseReq.partName}</span>
          </div>
          <div class="req-chips">${chipsHtml}</div>
        </div>
      `;
    }

    // 2. Stats bar (3 compact visual pills; detailed breakdown in hover popover)
    const power = computePowerStats(state);
    const pct = Math.round(power.ratio * 100);
    const coinsWhole = Math.floor(state.coins);
    const statsSig = `${coinsWhole}|${state.starSugar}|${pct}`;
    if (statsSig !== this.lastStatsSignature) {
      this.lastStatsSignature = statsSig;
      this.statsBarEl.innerHTML = `
        <span class="stat-pill stat-coin" data-tip-kind="stat" data-tip-id="coins">🪙 ${coinsWhole}</span>
        <span class="stat-pill stat-star" data-tip-kind="stat" data-tip-id="stars">✨ ${state.starSugar}</span>
        <span class="stat-pill" data-tip-kind="stat" data-tip-id="power">⚡ ${pct}%</span>
      `;
    }

    // 3. Action icon button states
    this.btnPeaceful.classList.toggle('btn-active', state.peacefulMode);
    this.btnPeaceful.textContent = '🕊️';
    this.btnMute.textContent = state.muted ? '🔇' : '🔊';
    this.btnPause.textContent = state.paused ? '▶️' : '⏸️';
    this.btnPause.classList.toggle('btn-active', state.paused);
    this.btnSpeed.textContent = `⏩${state.simSpeed}x`;
    this.btnSpeed.classList.toggle('btn-active', state.simSpeed > 1);
    this.btnEncyc.classList.toggle('btn-active', this.encyclopediaOpen);
    this.btnDemo.disabled = state.rocket.launching || state.rocket.launched;

    // 4. Launch countdown banner
    if (state.rocket.launching && !state.rocket.launched) {
      this.countdownEl.classList.remove('hidden');
      this.countdownEl.textContent = `🚀 発射まであと ${Math.max(0, state.rocket.launchCountdown).toFixed(1)} 秒！お見送りパレード！`;
    } else {
      this.countdownEl.classList.add('hidden');
    }

    // 5. Bottom dock selection + lock state + rotate arrow
    const toolBtns = this.bottomDockEl.querySelectorAll<HTMLButtonElement>('.tool-btn');
    toolBtns.forEach((btn) => {
      const t = btn.dataset.tool as BuildingType | 'demolish' | 'inspect' | undefined;
      btn.classList.toggle('active', t === state.selectedTool);
      if (t && t !== 'demolish' && t !== 'inspect' && BUILDINGS[t]) {
        const def = BUILDINGS[t];
        const locked = def.unlockPhase > state.rocket.phase;
        btn.classList.toggle('locked', locked);
        const costEl = btn.querySelector('.tool-cost');
        if (costEl) {
          costEl.textContent = locked
            ? `🔒P${def.unlockPhase}`
            : `🪙${def.costCoins}`;
        }
      }
    });
    const rotEl = this.bottomDockEl.querySelector('#btn-rotate-dir');
    if (rotEl) {
      rotEl.textContent = DIR_ARROWS[state.buildDir];
    }

    // 6. Side panel (Encyclopedia or Building Inspector)
    this.syncSidePanel(state);

    // 7. Victory Modal
    if (
      state.rocket.launched &&
      state.rocket.launchLiftY >= 12 &&
      !state.unlockedModalDismissed
    ) {
      if (this.victoryModalEl.classList.contains('hidden')) {
        this.victoryStatsEl.innerHTML = `
          <div class="modal-step"><strong>🍪 総生産スイーツ</strong><br />${state.stats.totalProduced} 個</div>
          <div class="modal-step"><strong>🚀 発射台納品数</strong><br />${state.stats.totalDelivered} 個</div>
          <div class="modal-step"><strong>🐾 満腹スライム</strong><br />${state.stats.slimesFed} 匹 (最大${state.stats.maxChain}連鎖!)</div>
        `;
        this.victoryModalEl.classList.remove('hidden');
      }
    }
  }

  private syncSidePanel(state: GameState): void {
    const inspected = state.inspectedBuildingId
      ? state.buildings[state.inspectedBuildingId]
      : null;

    if (!this.encyclopediaOpen && !inspected) {
      this.sidePanelEl.classList.add('hidden');
      this.lastSideSignature = '';
      return;
    }

    this.sidePanelEl.classList.remove('hidden');

    if (this.encyclopediaOpen) {
      const sig = `encyc_${this.encyclopediaTab}`;
      if (sig === this.lastSideSignature) return;
      this.lastSideSignature = sig;

      const tabsHtml = `
        <h3>
          <span>📖 お菓子＆スライム図鑑</span>
          <button class="btn" id="btn-close-side">✕</button>
        </h3>
        <div style="display:flex; gap:6px;">
          <button class="btn ${this.encyclopediaTab === 'recipes' ? 'btn-pink' : ''}" id="tab-recipes" style="flex:1; justify-content:center;">🍰 全${RECIPES.length}レシピ</button>
          <button class="btn ${this.encyclopediaTab === 'slimes' ? 'btn-pink' : ''}" id="tab-slimes" style="flex:1; justify-content:center;">🐾 スライム</button>
        </div>
      `;

      if (this.encyclopediaTab === 'recipes') {
        const listHtml = RECIPES.map((r) => {
          const inputsHtml = Object.entries(r.inputs)
            .map(
              ([id, qty]) =>
                `<img src="${this.sprites.itemDataUrls[id as ItemId]}" alt="" /><span>×${qty}</span>`
            )
            .join(' + ');
          const outItem = ITEMS[r.output];
          return `
            <div class="recipe-option" style="cursor:default;">
              <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:800;">
                <span>${r.name}</span>
                <span style="color:#845972;">${BUILDINGS[r.machine].shortName}</span>
              </div>
              <div class="recipe-io">
                ${inputsHtml} <span>→</span>
                <img src="${this.sprites.itemDataUrls[r.output]}" alt="" />
                <span>${outItem.calories}kcal・${outItem.effectLabel}</span>
              </div>
            </div>
          `;
        }).join('');

        this.sidePanelEl.innerHTML = tabsHtml + listHtml;
      } else {
        const slimesHtml = (Object.keys(SLIME_DEFS) as SlimeType[])
          .map((st) => {
            const d = SLIME_DEFS[st];
            return `
              <div class="slime-entry">
                <div class="slime-dot" style="background:${d.color};"></div>
                <div style="font-size:12px; line-height:1.35;">
                  <strong>${d.name}</strong> (報酬: +${d.starReward}✨)<br />
                  <span style="color:#845972;">${d.description}</span>
                </div>
              </div>
            `;
          })
          .join('');

        this.sidePanelEl.innerHTML = `
          ${tabsHtml}
          <div style="text-align:center; background:#fff; border-radius:14px; padding:10px; border:1.5px solid rgba(244,114,182,0.35);">
            <img src="${this.assets.kingSlimeBadgeUrl}" alt="King Slime" style="width:110px; height:110px; object-fit:contain;" />
            <div style="font-size:12px; font-weight:800;">満腹になると風船みたいに膨らんでボヨヨン連鎖！</div>
          </div>
          ${slimesHtml}
        `;
      }

      this.sidePanelEl.querySelector('#btn-close-side')?.addEventListener('click', () => {
        this.encyclopediaOpen = false;
        this.lastSideSignature = '';
      });
      this.sidePanelEl.querySelector('#tab-recipes')?.addEventListener('click', () => {
        this.encyclopediaTab = 'recipes';
        this.lastSideSignature = '';
      });
      this.sidePanelEl.querySelector('#tab-slimes')?.addEventListener('click', () => {
        this.encyclopediaTab = 'slimes';
        this.lastSideSignature = '';
      });
      return;
    }

    if (inspected) {
      const def = BUILDINGS[inspected.type];
      const inSummary = Object.entries(inspected.inputBuffer)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([k, v]) => `${ITEMS[k as ItemId].shortName}:${v}`)
        .join(', ');
      const ammoSummary = Object.entries(inspected.ammoBuffer)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([k, v]) => `${ITEMS[k as ItemId].shortName}:${v}`)
        .join(', ');
      const sig = `insp_${inspected.id}_${inspected.selectedRecipeId}_${inspected.totalCrafted}_${inSummary}_${ammoSummary}_${inspected.dir}`;
      if (sig === this.lastSideSignature) return;
      this.lastSideSignature = sig;

      const recipes = RECIPES_BY_MACHINE[inspected.type];
      let recipeHtml = '';
      if (recipes && recipes.length > 0) {
        recipeHtml = `
          <div style="font-size:12px; font-weight:800; margin-top:4px;">レシピ設定（自動または固定）</div>
          <button class="recipe-option ${inspected.selectedRecipeId === null ? 'selected' : ''}" data-rid="">
            <strong style="font-size:12px;">✨ 自動判定（届いた材料で作る）</strong>
          </button>
          ${recipes
            .map((r) => {
              const ins = Object.entries(r.inputs)
                .map(([id, q]) => `<img src="${this.sprites.itemDataUrls[id as ItemId]}" />×${q}`)
                .join('+');
              return `
                <button class="recipe-option ${inspected.selectedRecipeId === r.id ? 'selected' : ''}" data-rid="${r.id}">
                  <strong style="font-size:12px;">${r.name}</strong>
                  <div class="recipe-io">${ins} → <img src="${this.sprites.itemDataUrls[r.output]}" /></div>
                </button>
              `;
            })
            .join('')}
        `;
      }

      this.sidePanelEl.innerHTML = `
        <h3>
          <span>🛠️ ${def.name}</span>
          <button class="btn" id="btn-close-insp">✕</button>
        </h3>
        <div style="font-size:12px; color:#6b3e57; line-height:1.45;">
          ${def.description}<br />
          <strong>向き:</strong> ${DIR_LABELS[inspected.dir]} / <strong>累計加工:</strong> ${inspected.totalCrafted}
          ${inSummary ? `<br /><strong>材料待機:</strong> ${inSummary}` : ''}
          ${ammoSummary ? `<br /><strong>装填おやつ:</strong> ${ammoSummary}` : ''}
        </div>
        ${recipeHtml}
        <div style="display:flex; gap:8px; margin-top:4px;">
          <button class="btn" id="btn-insp-rot" style="flex:1; justify-content:center;">🔄 向き回転</button>
          <button class="btn btn-pink" id="btn-insp-del" style="flex:1; justify-content:center;">🗑️ 撤去</button>
        </div>
      `;

      this.sidePanelEl.querySelector('#btn-close-insp')?.addEventListener('click', () => {
        this.cb.onCloseInspect();
      });
      this.sidePanelEl.querySelector('#btn-insp-rot')?.addEventListener('click', () => {
        inspected.dir = ((inspected.dir + 1) % 4) as 0 | 1 | 2 | 3;
        this.lastSideSignature = '';
      });
      this.sidePanelEl.querySelector('#btn-insp-del')?.addEventListener('click', () => {
        demolishAt(state, inspected.x, inspected.y);
        this.cb.onCloseInspect();
      });
      this.sidePanelEl.querySelectorAll<HTMLButtonElement>('[data-rid]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rid = btn.dataset.rid || null;
          this.cb.onSelectRecipe(inspected.id, rid);
          this.lastSideSignature = '';
        });
      });
    }
  }
}
