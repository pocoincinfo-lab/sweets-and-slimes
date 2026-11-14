# Sweets & Slimes 実装・動作確認レポート (Walkthrough)

## 1. プロジェクト概要・リポジトリ
- **タイトル**: 『Sweets & Slimes 〜お菓子の工場とスイーツ・ロケット発射計画〜』
- **GitHub リポジトリ**: https://github.com/pocoincinfo-lab/sweets-and-slimes
- **ブランチ**: `main`（Conventional Commits 日本語規約に基づき段階的コミットを実施）

## 2. 実装した機能とファイル構成
- **ゲームデータ (`src/types/`, `src/data/`)**:
  - [game.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/types/game.ts): 型定義一式（全20アイテムID・`coins`・`costCoins`・`simSpeed` 等）
  - [items.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/data/items.ts): 原材料5種〜Tier 4（スター・ロケットパーツ、黄金パフェ宇宙衛星）までの全20アイテムと、4種のスライム定義
  - [recipes.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/data/recipes.ts): 前段階の加工品を複数段引き回す5階層ピラミッド型の全15レシピ
  - [buildings.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/data/buildings.ts): 全12種の施設（`costCoins` 2〜160コイン制）と `unlockPhase`（Phase 2 / Phase 4 段階解放）
  - [rocket.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/data/rocket.ts): 全8フェーズ（Phase 1 はクッキー20・砂糖15・小麦15・星3、Phase 8 でロケットパーツ100基＋黄金パフェ衛星5基要求）の建造要件
- **シミュレーション＆オーディオ (`src/core/`)**:
  - [world.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/core/world.ts): `80×80` 広域パステルマップ、中央工場広場 (`26..54`) を広く確保した三日月・リボン・尾根状の有機資源鉱脈（`paintOrganicVein`）、中央 `4×4` ワッフル発射台 (`38..41`)、初期配置建物ゼロの更地スタート（初期コイン `250🪙`, `tutorialStep: 0`）
  - [simulation.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/core/simulation.ts): 全方向直結型の工場物流・生産ロジック（`costCoins` 消費/100%返金、納品・生産・スライム満腹・完了後毎秒+2基礎収入）、5段階チュートリアル進行（`isBuildingUnlockedInTutorial`, `updateTutorialProgress`, `spawnTutorialSlime`, `skipTutorial`）、サブステップ分割による正確な倍速 (`1x/2x/5x`) 実行、スライム膨張＆ボヨヨン連鎖防衛＆ベルト居眠りライド、8段階ロケット打ち上げ物理
  - [audio.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/core/audio.ts): Web Audio API によるプロシージャル効果音シンセサイザー
  - [storage.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/core/storage.ts): LocalStorage (`sweets_and_slimes_save_v4`) 自動セーブ＆手動保存・初期化
- **ハイブリッド描画＆AI画像アセット (`src/render/`, `public/assets/`)**:
  - [assetLoader.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/render/assetLoader.ts): 外周フラッドフィルによる白背景自動透過処理
  - [spriteBake.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/render/spriteBake.ts): 全20種アイテムの高精細ベクタースプライト事前ベイク（イチゴ・クッキー・ホイップクリーム・タピオカティー・シュガー合金外装の小粒・ドット群を排除し、ツヤ・スター・なめらかグラデーション表現に刷新）
  - [renderer.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/render/renderer.ts): 画面外カリング付き Canvas 2D 描画（8段階ロケット＆衛星ウイング描画、綿あめ打ち上げ演出、スライム膨張＆表情変化、資源タイルのパステル連結フィールド＆間引きランドマークアイコン描画、オンマップのチュートリアル誘導ハイライト `drawTutorialGuide`、および `renderMinimap` による左下ミニマップ描画）
  - AI生成画像: `public/assets/title_banner.png`, `public/assets/rocket_emblem.png`, `public/assets/king_slime_badge.png`
- **グラスモーフィズムUI＆操作 (`src/ui/`, `src/main.ts`, `src/style.css`)**:
  - [hud.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/ui/hud.ts), [style.css](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/style.css) & [main.ts](file:///c:/Users/kamen/OneDrive/%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88/factorio-like/src/main.ts): WASD/右ドラッグ移動、ホイールズーム、左ドラッグ連続L字ベルト＆施設配置、テキスト削減＆アイコン中心UI（`.top-right-hud` 内の3ピル統計バー＋常時操作3ボタン `🍮 / ⏸️ / ⏩`）、カーソル連動の別窓ホバー解説（`#hover-popover`）、折りたたみ式左下「🍓 スイーツマップ」、チュートリアル連動で1施設 (`⛏️採掘機`) から段階解放される下部ドック＆ `#tutorial-card`、および画面真右下隅 (`fixed right: 8px; bottom: 8px`) 配置の `⚙️` メニューボタン（`#btn-menu`）＆展開パネル（`#menu-panel`）

## 3. 検証結果
1. **型チェック＆本番ビルド (`npm.cmd run build`)**:
   - Factorio級拡張版にて `tsc --noEmit && vite build` がエラー `0` 件で成功（`dist/` バンドル生成完了、`433ms`）。
   - ミニマップ＆ビジュアル改善版にて `tsc --noEmit && vite build` がエラー `0` 件で成功（`359ms`）。
   - 直感UI・ホバー別窓・コイン制・`80×80` 有機マップ版にて `tsc --noEmit && vite build` がエラー `0` 件で成功（`dist/assets/index-WIZ4Xnsf.js 107.74 kB`、`376ms`）。
   - 右下メニュー・トップHUD再整理版にて `tsc --noEmit && vite build` がエラー `0` 件で成功（`dist/assets/index-oFojhLJ8.js 111.29 kB`、`355ms`）。
   - 更地スタート・5段階チュートリアル・右下隅メニュー配置版にて `tsc --noEmit && vite build` がエラー `0` 件で成功（`dist/assets/index-D4PaoQrf.js 118.10 kB`、`364ms`）。
2. **ブラウザ実機検証 (`http://localhost:5173/`)**:
   - **更地スタート・STEP 1/5初期状態**: `#welcome-modal` が初期非表示で、マップ上に初期施設ゼロの更地状態、`#tutorial-card` (`STEP 1/5`)、ドック内施設1種（`⛏️採掘機` のみ）＋操作4ボタン、`#btn-menu` (`⚙️`) が真右下隅 (`right: 8px`, `bottom: 8px`) に配置されていることを確認。
   - **チュートリアル進行＆段階解放**: `(25, 38)` に採掘機配置で `STEP 2/5`（ベルト解放・2施設表示）へ進行、発射台までベルト接続＆小麦納品で `STEP 3/5`（風車発電機解放・3施設表示）へ進行、風車配置で `STEP 4/5`（オーブン・分配器・トンネル解放・6施設表示）へ進行することを確認。
   - **スキップ＆レイアウト**: `スキップ ⏭️` 押下で全12施設ボタンが表示され、`#bottom-dock` 右端と `#btn-menu` 左端に `95px` の余白が確保されていることを確認。
   - 従来の全15レシピ図鑑、コイン制（消費/100%返金）、ホバー別窓、メニュー開閉＆バッジ切替、ミニマップ移動、Phase 8打ち上げ確認済み。
   - **ブラウザコンソールエラー: 0件、ページエラー: 0件、ネットワーク失敗: 0件**。

## 4. ローカル起動方法
```bash
npm.cmd install
npm.cmd run dev -- --port 5173
```
起動後、ブラウザで `http://localhost:5173/` にアクセスしてください。
