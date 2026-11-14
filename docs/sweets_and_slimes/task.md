# Sweets & Slimes 開発タスクリスト

## Phase 1: リポジトリ初期化・ドキュメント・環境構築
- [x] `docs/sweets_and_slimes/` に開発ドキュメント（`task.md`, `implementation_plan.md`, `walkthrough.md`）を作成する
- [x] コミットルール（Conventional Commits 日本語規約）を策定し `README.md` に記載する
- [x] `.gitignore` を作成し、Git リポジトリ初期化と GitHub リモート作成・プッシュを試行する
- [x] Vite + TypeScript プロジェクト構成（`package.json`, `tsconfig.json`, `index.html`）を作成し、依存関係をインストールする

## Phase 2: ビジュアルアセット生成
- [x] `image-generator` によりタイトルバナー（`public/assets/title_banner.png`）を生成する
- [x] `image-generator` によりスイーツロケット紋章（`public/assets/rocket_emblem.png`）を生成する
- [x] `image-generator` によりキングスライム紋章（`public/assets/king_slime_badge.png`）を生成する

## Phase 3: コアエンジン・ゲームデータ実装
- [x] 型定義（`src/types/game.ts`）を作成する
- [x] 全17種のおやつ・素材データ（`src/data/items.ts`）を作成する
- [x] 生産レシピ（`src/data/recipes.ts`）と12種の建物定義（`src/data/buildings.ts`）を作成する
- [x] Web Audio API プロシージャル効果音エンジン（`src/core/audio.ts`）を実装する
- [x] `64x64` マップ生成とスターター工場自動配置（`src/core/world.ts`）を実装する
- [x] ベルト物流・加工・腹ペコスライム膨張＆ボヨヨン連鎖防衛・5段階スイーツロケット発射ロジック（`src/core/simulation.ts`）を実装する

## Phase 4: レンダリング・UI統合・セーブ機能
- [x] アセット透過・バッジ読み込みローダー（`src/render/assetLoader.ts`）を実装する
- [x] OffscreenCanvas スプライトベイク処理（`src/render/spriteBake.ts`）を実装する
- [x] ぷにぷにアニメ・ロケット段階描画・綿あめ打ち上げ演出付き Canvas レンダラー（`src/render/renderer.ts`）を実装する
- [x] グラスモーフィズム UI・レシピ図鑑・セーブ/ロード・打ち上げモーダル（`src/ui/hud.ts`, `src/style.css`, `src/main.ts`）を実装する

## Phase 5: 検証・ドキュメント完了・最終コミット
- [x] `npm.cmd run build` にて型エラーおよびビルドエラーが 0 件であることを確認する
- [x] 開発サーバーを起動し、ブラウザ上でカメラ操作・ベルト物流・スライム膨張＆連鎖・ロケット打ち上げ演出・コンソールエラー0件を検証する
- [x] `walkthrough.md` と `task.md` を最新化して最終コミット＆プッシュを行う
