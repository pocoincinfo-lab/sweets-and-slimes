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
- [x] 全20種のおやつ・素材データ（`src/data/items.ts`）を作成する
- [x] 5階層ピラミッド生産レシピ15種（`src/data/recipes.ts`）と段階アンロック付き12種の建物定義（`src/data/buildings.ts`）を作成する
- [x] Web Audio API プロシージャル効果音エンジン（`src/core/audio.ts`）を実装する
- [x] `64x64` 大規模鉱脈マップ生成とスターター工場自動配置（`src/core/world.ts`）を実装する
- [x] ベルト物流・加工・腹ペコスライム膨張＆ボヨヨン連鎖防衛・8段階スイーツロケット発射ロジック・倍速サブステップ実行（`src/core/simulation.ts`）を実装する

## Phase 4: レンダリング・UI統合・セーブ機能
- [x] アセット透過・バッジ読み込みローダー（`src/render/assetLoader.ts`）を実装する
- [x] OffscreenCanvas スプライトベイク処理（`src/render/spriteBake.ts`）を実装する
- [x] ぷにぷにアニメ・8段階ロケット＆衛星描画・綿あめ打ち上げ演出付き Canvas レンダラー（`src/render/renderer.ts`）を実装する
- [x] グラスモーフィズム UI・倍速ボタン・ロックバッジ・図鑑・セーブ/ロード・打ち上げモーダル（`src/ui/hud.ts`, `src/style.css`, `src/main.ts`）を実装する

## Phase 5: 検証・ドキュメント完了・最終コミット
- [x] `npm.cmd run build` にて型エラーおよびビルドエラーが 0 件であることを確認する
- [x] 開発サーバーを起動し、ブラウザ上で全8フェーズ・15レシピ・倍速切替・スライム防衛・ロケット打ち上げ演出・コンソールエラー0件を検証する
- [x] `walkthrough.md` と `task.md` を最新化して最終コミット＆プッシュを行う

## Phase 6: ミニマップ実装・集合体恐怖症対策（ビジュアル改善）
- [x] 資源タイルのパステル連結フィールド化＆外周ソフト枠線・間引きアイコン描画 (`src/render/renderer.ts`)
- [x] アイテムスプライトの粒・ドット群除去と単一シンボル/ツヤ表現への変更 (`src/render/spriteBake.ts`)
- [x] 下部ドックの絵文字アイコンバッジ化 (`.tool-icon`) とカテゴリ区切り線 (`.dock-divider`) 追加 (`src/ui/hud.ts`, `src/style.css`)
- [x] 左下「🍓 スイーツマップ」(`156×156` Canvas ミニマップ、クリック＆ドラッグでのカメラジャンプ、折りたたみトグル) 実装 (`src/render/renderer.ts`, `src/ui/hud.ts`, `src/main.ts`, `src/style.css`)
- [x] `npm.cmd run build` 成功（0件エラー）およびブラウザ実機検証・ドキュメント更新・プッシュ完了

## Phase 7: 直感UI・ホバー別窓・コイン経済・80×80有機広域マップ刷新
- [x] 全施設コイン制（`🪙 おやつコイン`、`costCoins` 2〜160・無料廃止・撤去時100%返金・納品/生産/スライム満腹/毎秒+2基礎収入）実装 (`src/types/game.ts`, `src/data/buildings.ts`, `src/core/simulation.ts`, `src/core/world.ts`, `src/core/storage.ts`)
- [x] `80×80` 広域マップ拡張・中央工場広場 (`26..54`) 確保・三日月/リボン/尾根状の有機的資源鉱脈 `paintOrganicVein` 生成 (`src/core/world.ts`, `src/core/simulation.ts`, `src/render/renderer.ts`, `src/main.ts`)
- [x] 文字数を削ぎ落としたアイコン中心UI（`#hint-strip` / `.minimap-legend` 廃止、アイコン中心ロケットチップ、3ピルステータス、アイコン操作バー、名称省略ドック）＋別窓ホバー解説（`#hover-popover`）実装 (`src/ui/hud.ts`, `src/style.css`, `src/main.ts`)
- [x] `npm.cmd run build` 成功（`376ms`, 0件エラー）およびブラウザ実機検証（コイン増減・別窓ホバー・UI重なり＆コンソールエラー0件）完了・プッシュ
