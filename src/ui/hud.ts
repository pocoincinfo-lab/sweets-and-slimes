import { BUILDING_LIST, BUILDINGS } from '../data/buildings';
import { ITEMS, SLIME_DEFS } from '../data/items';
import { RECIPES, RECIPES_BY_MACHINE } from '../data/recipes';
import { ROCKET_PHASES } from '../data/rocket';
import {
  computePowerStats,
  demolishAt,
  getItemsPerMinute,
} from '../core/simulation';
import { LoadedAssets } from '../render/assetLoader';
import { SpriteBank } from '../render/spriteBake';
import { BuildingType, GameState, ItemId, SlimeType } from '../types/game';

export interface HudCallbacks {
  onSelectTool: (tool: BuildingType | 'demolish' | 'inspect') => void;
  onRotate: () => void;
  onCenterSilo: () => void;
  onRushWave: () => void;
  onTogglePeaceful: () => void;
  onDemoAdvancePhase: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onSave: () => void;
  onReset: () => void;
  onDismissVictory: () => void;
  onSelectRecipe: (buildingId: string, recipeId: string | null) => void;
  onCloseInspect: () => void;
}

const DIR_LABELS = ['北 ↑', '東 →', '南 ↓', '西 ←'];

export class GameHud {
  private root: HTMLElement;
  private sprites: SpriteBank;
  private assets: LoadedAssets;
  private cb: HudCallbacks;

  private encyclopediaOpen = false;
  private encyclopediaTab: 'recipes' | 'slimes' = 'recipes';
  private welcomeOpen = true;
  private lastSideSignature = '';

  // Cached DOM references
  private rocketCardEl!: HTMLElement;
  private statsBarEl!: HTMLElement;
  private btnPeaceful!: HTMLButtonElement;
  private btnMute!: HTMLButtonElement;
  private btnPause!: HTMLButtonElement;
  private btnEncyc!: HTMLButtonElement;
  private btnDemo!: HTMLButtonElement;
  private countdownEl!: HTMLElement;
  private sidePanelEl!: HTMLElement;
  private hintStripEl!: HTMLElement;
  private bottomDockEl!: HTMLElement;
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
          <button class="btn btn-pink" id="btn-rush" title="今すぐスライムを呼んでキラキラ星を稼ぐ">🍮 おかわり!</button>
          <button class="btn" id="btn-peaceful" title="平和モード切替">🕊️ 平和</button>
          <button class="btn btn-amber" id="btn-demo" title="テスト用：現在のフェーズを即納品して次へ">🚀 次Phase</button>
          <button class="btn" id="btn-mute">🔊 音</button>
          <button class="btn" id="btn-pause">⏸️ 停止</button>
          <button class="btn" id="btn-encyc">📖 図鑑</button>
          <button class="btn" id="btn-save">💾 保存</button>
          <button class="btn" id="btn-reset">🔄 初期化</button>
          <button class="btn" id="btn-help">❓ 遊び方</button>
        </div>
      </div>

      <div class="countdown-banner hidden" id="countdown-banner"></div>

      <div class="middle-area">
        <div class="glass-panel side-panel hidden" id="side-panel"></div>
      </div>

      <div class="bottom-wrap">
        <div class="hint-strip" id="hint-strip"></div>
        <div class="glass-panel bottom-dock" id="bottom-dock"></div>
      </div>

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
              <strong>2. 満腹ボヨヨン防衛</strong><br />
              機械は絶対壊されません！キャノンでおやつを撃つとスライムが風船みたいに膨らんで吹っ飛び、<strong>キラキラ星✨</strong>を落とします！
            </div>
            <div class="modal-step">
              <strong>3. 目指せ宇宙打ち上げ！</strong><br />
              中央の発射台にベルトでお菓子パーツを流し込み、5段階の「超巨大スイーツ・ロケット」を打ち上げよう！
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
    this.btnEncyc = this.root.querySelector('#btn-encyc')!;
    this.btnDemo = this.root.querySelector('#btn-demo')!;
    this.countdownEl = this.root.querySelector('#countdown-banner')!;
    this.sidePanelEl = this.root.querySelector('#side-panel')!;
    this.hintStripEl = this.root.querySelector('#hint-strip')!;
    this.bottomDockEl = this.root.querySelector('#bottom-dock')!;
    this.welcomeModalEl = this.root.querySelector('#welcome-modal')!;
    this.victoryModalEl = this.root.querySelector('#victory-modal')!;
    this.victoryStatsEl = this.root.querySelector('#victory-stats')!;

    this.root.querySelector('#btn-rush')!.addEventListener('click', () => this.cb.onRushWave());
    this.btnPeaceful.addEventListener('click', () => this.cb.onTogglePeaceful());
    this.btnDemo.addEventListener('click', () => this.cb.onDemoAdvancePhase());
    this.btnMute.addEventListener('click', () => this.cb.onToggleMute());
    this.btnPause.addEventListener('click', () => this.cb.onTogglePause());
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

    this.buildBottomDock();
  }

  private buildBottomDock(): void {
    this.bottomDockEl.innerHTML = '';

    for (const def of BUILDING_LIST) {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.dataset.tool = def.type;
      btn.title = `${def.name}: ${def.description}`;
      btn.innerHTML = `
        <span class="tool-hotkey">${def.hotkey}</span>
        <span class="tool-swatch" style="background:${def.accentColor}"></span>
        <span class="tool-name">${def.shortName}</span>
        <span class="tool-cost">${def.costStars === 0 ? '無料' : `${def.costStars}✨`}</span>
      `;
      btn.addEventListener('click', () => this.cb.onSelectTool(def.type));
      this.bottomDockEl.appendChild(btn);
    }

    const extras: Array<{ id: 'inspect' | 'demolish' | 'rotate' | 'center'; label: string; key: string; swatch: string }> = [
      { id: 'inspect', label: '確認', key: 'Q', swatch: '#38BDF8' },
      { id: 'rotate', label: '回転', key: 'R', swatch: '#FBBF24' },
      { id: 'demolish', label: '撤去', key: 'X', swatch: '#F43F5E' },
      { id: 'center', label: '発射台', key: 'H', swatch: '#F472B6' },
    ];

    for (const ex of extras) {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      if (ex.id === 'inspect' || ex.id === 'demolish') {
        btn.dataset.tool = ex.id;
      }
      btn.innerHTML = `
        <span class="tool-hotkey">${ex.key}</span>
        <span class="tool-swatch" style="background:${ex.swatch}"></span>
        <span class="tool-name">${ex.label}</span>
        <span class="tool-cost">操作</span>
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
    // 1. Rocket progress card
    const phaseReq = ROCKET_PHASES[Math.min(state.rocket.phase, ROCKET_PHASES.length) - 1];
    let chipsHtml = '';
    if (state.rocket.launched) {
      chipsHtml = `<span class="req-chip done">🚀 打ち上げ成功！宇宙を航行中！</span>`;
    } else if (state.rocket.launching) {
      chipsHtml = `<span class="req-chip">🔥 点火カウントダウン中！</span>`;
    } else if (phaseReq) {
      for (const [id, need] of Object.entries(phaseReq.requiredItems)) {
        const iid = id as ItemId;
        const have = state.rocket.delivered[iid] ?? 0;
        const done = have >= (need ?? 0);
        chipsHtml += `
          <span class="req-chip ${done ? 'done' : ''}">
            <img src="${this.sprites.itemDataUrls[iid]}" alt="${ITEMS[iid].shortName}" />
            ${ITEMS[iid].shortName} ${Math.min(have, need ?? 0)}/${need}
          </span>
        `;
      }
      const starDone = state.starSugar >= phaseReq.requiredStars;
      chipsHtml += `
        <span class="req-chip ${starDone ? 'done' : ''}">
          ✨ ${Math.min(state.starSugar, phaseReq.requiredStars)}/${phaseReq.requiredStars}
        </span>
      `;
    }

    this.rocketCardEl.innerHTML = `
      <img class="rocket-thumb" src="${this.assets.rocketEmblemUrl}" alt="Rocket" />
      <div class="rocket-info">
        <div class="rocket-title-row">
          <span class="phase-badge">${state.rocket.launched ? 'COMPLETE' : `Phase ${state.rocket.phase}/5`}</span>
          <span>${state.rocket.launched ? 'スイーツ・ロケット発射完了！' : phaseReq.partName}</span>
        </div>
        <div class="req-chips">${chipsHtml}</div>
      </div>
    `;

    // 2. Stats bar
    const power = computePowerStats(state);
    const pct = Math.round(power.ratio * 100);
    const ipm = getItemsPerMinute(state);
    this.statsBarEl.innerHTML = `
      <span class="stat-pill stat-star">✨ ${state.starSugar}</span>
      <span class="stat-pill">⚡ ${power.supply}/${power.demand} (${pct}%)</span>
      <span class="stat-pill">📦 ${ipm}個/分</span>
      <span class="stat-pill">🐾 ${state.stats.slimesFed}匹満腹</span>
    `;

    // 3. Action button states
    this.btnPeaceful.classList.toggle('btn-active', state.peacefulMode);
    this.btnPeaceful.textContent = state.peacefulMode ? '🕊️ 平和中' : '🕊️ 平和';
    this.btnMute.textContent = state.muted ? '🔇 消音' : '🔊 音';
    this.btnPause.textContent = state.paused ? '▶️ 再開' : '⏸️ 停止';
    this.btnPause.classList.toggle('btn-active', state.paused);
    this.btnEncyc.classList.toggle('btn-active', this.encyclopediaOpen);
    this.btnDemo.disabled = state.rocket.launching || state.rocket.launched;

    // 4. Launch countdown banner
    if (state.rocket.launching && !state.rocket.launched) {
      this.countdownEl.classList.remove('hidden');
      this.countdownEl.textContent = `🚀 発射まであと ${Math.max(0, state.rocket.launchCountdown).toFixed(1)} 秒！お見送りパレード！`;
    } else {
      this.countdownEl.classList.add('hidden');
    }

    // 5. Bottom dock selection + hint strip
    const toolBtns = this.bottomDockEl.querySelectorAll<HTMLButtonElement>('.tool-btn');
    toolBtns.forEach((btn) => {
      const t = btn.dataset.tool;
      btn.classList.toggle('active', t === state.selectedTool);
    });

    if (state.selectedTool === 'demolish') {
      this.hintStripEl.textContent = '🗑️ 撤去モード: 左クリック/ドラッグで施設を撤去（コスト100%返金） | スライムクリックでデコピン!';
    } else if (state.selectedTool === 'inspect') {
      this.hintStripEl.textContent = '🔍 確認モード: 機械をクリックしてレシピ変更や生産状況を確認 | スライムクリックでデコピン!';
    } else {
      const def = BUILDINGS[state.selectedTool];
      this.hintStripEl.textContent = `🛠️ ${def.name} [向き:${DIR_LABELS[state.buildDir]}] — ${def.description} (WASD/右ドラッグ:移動, ホイール:ズーム, R:回転)`;
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
          <button class="btn ${this.encyclopediaTab === 'recipes' ? 'btn-pink' : ''}" id="tab-recipes" style="flex:1; justify-content:center;">🍰 全12レシピ</button>
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
