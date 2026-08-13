# モノレポ再編成(packages/wasm-core + packages/app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** リポジトリを`packages/wasm-core/`(MoonBitソース+wasmビルド成果物)と`packages/app/`(Reactアプリ)に分離するbunワークスペース化を行い、「wasmとbrowserの境界」がディレクトリ構造だけで一目でわかる構成にする。**この計画では挙動を一切変更しない(振る舞い凍結)** — 全てのファイル移動・設定分割のみ。

**Architecture:** ルートを`workspaces: ["packages/*"]`を持つbunワークスペースのルートにし、`packages/wasm-core/`と`packages/app/`をワークスペースメンバーにする。開発ツール(vite/vitest/oxlint/oxfmt/typescript等)はルートの`devDependencies`に集約し、`packages/app/`はランタイム依存関係(react/zustand等)のみを持つ。`packages/wasm-core/`はビルド成果物`dist/aco_core.wasm`を引き続きリポジトリにコミットする(moonツールチェーンなしでもアプリが動く現状の方針を維持)。

**Tech Stack:** bun workspaces, mise(`dir`タスクキー), Vite 8, MoonBit(`moon` CLI)。

## Global Constraints

- **振る舞い凍結**: この計画はファイル移動・設定分割のみを行う。ロジック・テストの内容・UIの挙動は一切変更しない。パッケージのバージョン更新も含めない(Task 2で別途扱う)。
- **スパイク検証済み(このセッション内で実施済み、再検証不要)**: Vite開発サーバーは、ルート`package.json`に`"workspaces": ["packages/*"]`を設定した状態であれば、`new URL("../相対パス/...", import.meta.url)`でワークスペースルート外(`packages/wasm-core/dist/`)のファイルを`/@fs/`経由で正しく配信できることを実機確認済み(200 OK)。本番ビルド(`vite build`)も同様に、ワークスペース外のファイルを問題なく`dist/assets/`にハッシュ付きでバンドルすることを確認済み。**したがって`server.fs.allow`の追加設定は不要**。
- **`dir`キー検証済み**: mise.tomlのタスクは`dir = "packages/app"`のようなキーでタスクの実行ディレクトリを変更できることを実機確認済み(`pwd`で検証)。
- **bunfig.tomlの探索範囲(実機確認済み)**: `bun test`はカレントディレクトリの`bunfig.toml`しか見ない(親ディレクトリを遡って探索しない)。そのため`[test] preload`セクションは`packages/app/bunfig.toml`に置く必要がある。一方`bun install`はワークスペースルートで実行するため、`[install]`セクション(`minimumReleaseAge`)はルートの`bunfig.toml`に残す。**2つのbunfig.tomlに分割する**(後述Task 1のStep内で詳細)。
- **moonbit/aco_core/配下のテンプレート由来ファイルは移動しない(プルーン)**: `.githooks/`、`.github/workflows/copilot-setup-steps.yml`、`AGENTS.md`、`LICENSE`、`README.mbt.md`、`README.md`(シンボリックリンク)は`moon new`のスキャフォールディング由来の汎用ファイルで、このプロジェクト固有の情報を持たない(設計上の経緯は`docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md`に既に記録済み)。`packages/wasm-core/`には移動しない。
- **4コマンド確認を全タスク境界で徹底**: `mise run test`(vitest)、`mise run test:bun`(bun native)、`mise run build`、`mise run lint`の4つ全てをタスク完了時に実行して結果を報告する。加えてこの計画では`moon test`(`packages/wasm-core/`から)も確認対象に含める。
- **lintの期待値**: `mise run lint`(oxlint)は`useSimulation.ts`の`react-hooks(exhaustive-deps)`エラー1件でexit 1になるのが正常(既知・対応不要、Plan 2で扱う)。
- **作業はブランチを切って行う**: `main`から新しいブランチ(worktree)を作成してから着手する(既に`aco-monorepo-restructure`worktreeを作成済み — このworktree内で作業する)。

---

### Task 1: ワークスペースルート化とディレクトリ移動

**Files:**
- Create: `packages/wasm-core/`(`moonbit/aco_core/`から移動、一部プルーン)
- Create: `packages/wasm-core/package.json`
- Create: `packages/wasm-core/dist/aco_core.wasm`(ビルド成果物、コミット対象)
- Create: `packages/app/`(`src/`と各種設定ファイルを移動)
- Create: `packages/app/package.json`
- Create: `packages/app/bunfig.toml`
- Modify: `package.json`(ワークスペースルート化)
- Modify: `mise.toml`(全タスクに`dir`を追加)
- Modify: `bunfig.toml`(`[test]`セクションを削除、`[install]`のみ残す)
- Modify: `.oxlintrc.json`(`ignorePatterns`を新パスに更新)
- Modify: `.gitignore`(`dist`を`packages/app/dist`に更新)
- Modify: `packages/app/src/components/ACOSimulation/index.tsx`(wasmパス参照)
- Modify: `packages/app/src/hooks/useSimulation.test.ts`(wasmパス参照)
- Modify: `packages/app/src/lib/aco-wasm/adapter.test.ts`(wasmパス参照)
- Delete: `moonbit/`(空になった元ディレクトリ)

**Interfaces:**
- Consumes: なし
- Produces: `packages/wasm-core/dist/aco_core.wasm`(以降の全タスクがこのパスをwasmの単一の入手元とする)

- [ ] **Step 1: `packages/wasm-core/`を作成しMoonBitソースを移動する**

```bash
mkdir -p packages
git mv moonbit/aco_core packages/wasm-core
```

- [ ] **Step 2: テンプレート由来ファイルをプルーンする**

```bash
git rm -r packages/wasm-core/.githooks
git rm -r packages/wasm-core/.github
git rm packages/wasm-core/AGENTS.md
git rm packages/wasm-core/LICENSE
git rm packages/wasm-core/README.mbt.md
git rm packages/wasm-core/README.md
```

(`README.md`は`README.mbt.md`へのシンボリックリンクなので`git rm`で問題ない)

- [ ] **Step 3: 空になった`moonbit/`ディレクトリを削除する**

```bash
rmdir moonbit
```

- [ ] **Step 4: `packages/wasm-core/package.json`を新規作成する**

```json
{
  "name": "@aco/wasm-core",
  "version": "0.0.0",
  "private": true
}
```

- [ ] **Step 5: wasmをビルドし`packages/wasm-core/dist/`に配置する**

```bash
mkdir -p packages/wasm-core/dist
cd packages/wasm-core && moon build --target wasm --release && cd -
cp packages/wasm-core/_build/wasm/release/build/aco_core.wasm packages/wasm-core/dist/aco_core.wasm
git add packages/wasm-core/dist/aco_core.wasm
```

- [ ] **Step 6: `packages/app/`を作成し`src/`を移動する**

```bash
mkdir -p packages/app
git mv src packages/app/src
```

- [ ] **Step 7: 設定ファイルを`packages/app/`へ移動する**

```bash
git mv index.html packages/app/index.html
git mv vite.config.ts packages/app/vite.config.ts
git mv vitest.config.ts packages/app/vitest.config.ts
git mv tsconfig.json packages/app/tsconfig.json
git mv tsconfig.app.json packages/app/tsconfig.app.json
git mv tsconfig.node.json packages/app/tsconfig.node.json
git mv tailwind.config.js packages/app/tailwind.config.js
git mv postcss.config.js packages/app/postcss.config.js
git mv components.json packages/app/components.json
git mv bun-test-setup.ts packages/app/bun-test-setup.ts
```

(`vite.config.ts`・`vitest.config.ts`は`path.resolve(__dirname, "./src")`のように自身からの相対パスで`@`エイリアスを解決しているため、`packages/app/`直下に移動しても中身の変更は不要。`tsconfig.app.json`の`"include": ["src"]`、`components.json`の`"css": "src/index.css"`も同様に無変更でよい。)

- [ ] **Step 8: `packages/app/bunfig.toml`を新規作成する(`[test]`セクションのみ)**

```toml
[test]
preload = ["./bun-test-setup.ts"]
```

- [ ] **Step 9: ルートの`bunfig.toml`から`[test]`セクションを削除する**

`bunfig.toml`(ルート)を以下の内容に置き換える:

```toml
[install]
# 3日以上前に公開されたバージョンのみインストール
minimumReleaseAge = 259200 # 秒
# 年齢ゲートから除外する信頼済みパッケージ
minimumReleaseAgeExcludes = ["@types/node", "typescript"]
```

- [ ] **Step 10: `packages/app/package.json`を新規作成する**

```json
{
  "name": "@aco/app",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:bun": "bun test",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  },
  "dependencies": {
    "@radix-ui/react-label": "^2.1.15",
    "@radix-ui/react-slider": "^1.4.7",
    "@tanstack/react-router": "^1.170.24",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.30.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "tailwind-merge": "^3.6.0",
    "zustand": "^5.0.14"
  }
}
```

- [ ] **Step 11: ルートの`package.json`をワークスペースルート化する**

`package.json`(ルート)を以下の内容に置き換える:

```json
{
  "name": "aco-simulation",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "lint": "oxlint .",
    "format": "oxfmt .",
    "format:check": "oxfmt --check ."
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^26.2.0",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@vitejs/plugin-react": "^6.0.5",
    "@vitest/ui": "^4.1.10",
    "autoprefixer": "^10.5.4",
    "bun-types": "^1.3.14",
    "jsdom": "^30.0.1",
    "oxfmt": "^0.62.0",
    "oxlint": "^1.77.0",
    "postcss": "^8.5.26",
    "tailwindcss": "^4.3.3",
    "typescript": "~7.0.2",
    "vite": "^8.2.1",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 12: 依存関係を再インストールする**

```bash
bun install
```

期待結果: `bun.lock`が更新される(ワークスペーストポロジーの反映)。バージョン自体は変わらない(バージョン更新はTask 2で扱う)。

- [ ] **Step 13: wasmパス参照を3箇所更新する**

`packages/app/src/components/ACOSimulation/index.tsx`:

```diff
-    const wasmUrl = new URL("../../wasm/aco_core.wasm", import.meta.url);
+    const wasmUrl = new URL("../../../../wasm-core/dist/aco_core.wasm", import.meta.url);
```

`packages/app/src/hooks/useSimulation.test.ts`:

```diff
-  const wasmBytes = readFileSync(resolve(import.meta.dirname, "../wasm/aco_core.wasm"));
+  const wasmBytes = readFileSync(resolve(import.meta.dirname, "../../../wasm-core/dist/aco_core.wasm"));
```

`packages/app/src/lib/aco-wasm/adapter.test.ts`:

```diff
-const wasmBytes = readFileSync(resolve(import.meta.dirname, "../../wasm/aco_core.wasm"));
+const wasmBytes = readFileSync(resolve(import.meta.dirname, "../../../../wasm-core/dist/aco_core.wasm"));
```

- [ ] **Step 14: `mise.toml`を全タスク`dir`対応に更新する**

`mise.toml`を以下の内容に置き換える:

```toml
[tools]
node = "24.19.0"
bun = "1.3.14"

[tasks.dev]
description = "開発サーバーを起動"
dir = "packages/app"
run = "bun run dev"

[tasks.build]
description = "本番ビルド"
dir = "packages/app"
run = "bun run build"

[tasks.lint]
description = "oxlint を実行"
run = "bun run lint"

[tasks.format]
description = "oxfmt でフォーマット"
run = "bun run format"

[tasks."format:check"]
description = "oxfmt でフォーマットチェック"
run = "bun run format:check"

[tasks.preview]
description = "ビルド結果をプレビュー"
dir = "packages/app"
run = "bun run preview"

[tasks.test]
description = "vitest でテストを実行"
dir = "packages/app"
run = "bun run test"

[tasks."test:bun"]
description = "bun test でテストを実行"
dir = "packages/app"
run = "bun run test:bun"

[tasks."test:ui"]
description = "vitest UI を起動"
dir = "packages/app"
run = "bun run test:ui"

[tasks."test:coverage"]
description = "テストカバレッジを計測"
dir = "packages/app"
run = "bun run test:coverage"

[tasks.install]
description = "依存関係をインストール"
run = "bun install"

[tasks."build:wasm"]
description = "MoonBitコアをwasmでビルドしpackages/wasm-core/dist/にコピー"
dir = "packages/wasm-core"
run = """
moon build --target wasm --release
cp _build/wasm/release/build/aco_core.wasm dist/aco_core.wasm
"""

[settings]
experimental = true
minimum_release_age = "3d"
```

(`lint`/`format`/`format:check`/`install`はワークスペースルートで実行するため`dir`を付けない。)

- [ ] **Step 15: `.oxlintrc.json`の`ignorePatterns`を更新する**

```diff
-  "ignorePatterns": ["dist", "src/routeTree.gen.ts"]
+  "ignorePatterns": ["packages/app/dist", "packages/app/src/routeTree.gen.ts", "packages/wasm-core/_build"]
```

`.oxfmtrc.json`も同様に更新する:

```diff
-  "ignorePatterns": ["dist", "src/routeTree.gen.ts"]
+  "ignorePatterns": ["packages/app/dist", "packages/app/src/routeTree.gen.ts", "packages/wasm-core/_build"]
```

- [ ] **Step 16: `.gitignore`を更新する**

```diff
 node_modules
-dist
-dist-ssr
+packages/app/dist
+packages/app/dist-ssr
 *.local
```

(`packages/wasm-core/dist/`は意図的にgitignore対象**外**のまま — ビルド成果物`aco_core.wasm`はコミットする方針を維持するため。)

- [ ] **Step 17: 4コマンド + `moon test`で確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
cd packages/wasm-core && moon test && cd -
```

期待結果:
- `mise run test`(vitest): 24 passed(移動前と同じ件数)
- `mise run test:bun`: 24 pass, 0 fail(vitestと一致)
- `mise run build`: 成功。`packages/app/dist/assets/`に`aco_core-*.wasm`が正しく出力される
- `mise run lint`: `useSimulation.ts`の既知の警告1件のみでexit 1(想定内)
- `moon test`: 56 passed(移動前と同じ件数)

- [ ] **Step 18: `packages/wasm-core/dist/aco_core.wasm`が新規ビルドとバイト一致することを確認する**

```bash
sha256sum packages/wasm-core/dist/aco_core.wasm
cd packages/wasm-core && moon build --target wasm --release && cd -
sha256sum packages/wasm-core/_build/wasm/release/build/aco_core.wasm
```

期待結果: 2つのsha256が一致する(コミット対象のバイナリがソースから再現可能であることの確認。Plan Bの最終レビューで確立した検証習慣を踏襲)。

- [ ] **Step 19: ブラウザでの起動確認**

```bash
mise run dev
```

`http://localhost:5173/`(または表示されたポート)を開き、シミュレーションが読み込み→描画→開始まで動作することを目視確認する。確認後、開発サーバーを停止する。

- [ ] **Step 20: コミット**

```bash
git add -A
git commit -m "refactor: packages/wasm-core + packages/appへのモノレポ再編成"
```

---

### Task 2: パッケージ更新(minimumReleaseAgeが許す最新化)

**Files:**
- Modify: `package.json`(ルート、devDependencies)
- Modify: `packages/app/package.json`(dependencies)
- Modify: `bun.lock`

**Interfaces:**
- Consumes: Task 1で確立したワークスペース構造
- Produces: なし

- [ ] **Step 1: 更新可能なパッケージを確認する**

```bash
bun outdated
```

このセッション開始時点(2026-08-13)の確認では以下の6件が対象(実行時に増えている可能性があるため、実際の出力を優先する):

| Package | 現在 | 更新先 |
|---|---|---|
| `@tanstack/react-router` | 1.170.24 | 1.170.27 |
| `lucide-react` | 1.30.0 | 1.31.0 |
| `zustand` | 5.0.14 | 5.0.15 |
| `@testing-library/jest-dom` (dev) | 7.0.0 | 7.0.1 |
| `oxfmt` (dev) | 0.62.0 | 0.63.0 |
| `oxlint` (dev) | 1.77.0 | 1.78.0 |

- [ ] **Step 2: ワークスペース全体を更新する**

```bash
bun update
```

- [ ] **Step 3: 4コマンドで確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
```

期待結果: Task 1完了時点と同じ(24/24両ランナー一致、ビルド成功、既知のlint警告のみ)。パッケージ更新によるテスト結果の変化がないことを確認する。

- [ ] **Step 4: コミット**

```bash
git add package.json packages/app/package.json bun.lock
git commit -m "chore: 全依存関係をminimumReleaseAgeが許す最新版に更新"
```

---

### Task 3: README更新と最終確認

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1・Task 2の完了
- Produces: なし

- [ ] **Step 1: `README.md`を更新する**

現在の`README.md`は`create-vite`のテンプレート由来で、eslintに関する記述(このプロジェクトでは既にoxlintに置き換え済み)や、モノレポ構成・MoonBit/wasmビルドに関する説明が欠けている。以下の内容に全面的に置き換える:

```markdown
# aco-simulation

蟻コロニー最適化(ACO)アルゴリズムのシミュレーション。シミュレーションのホットパスはMoonBit(WebAssembly)で実装され、Reactアプリから利用する。

## ディレクトリ構成

\`\`\`
aco-simulation/
├─ packages/
│  ├─ wasm-core/    # MoonBitソース。シミュレーションのホットパス(アリの行動計算・
│  │                 # フェロモン処理)を実装し、wasmにビルドする。dist/aco_core.wasm
│  │                 # はビルド成果物としてリポジトリにコミットされており、moon
│  │                 # ツールチェーンがなくてもアプリを動かせる。
│  └─ app/           # Reactアプリ本体。packages/wasm-core/dist/aco_core.wasmを
│                     # ロードしてシミュレーションを実行・描画する。
└─ mise.toml         # ツール・タスク管理
\`\`\`

## 開発環境のセットアップ

このプロジェクトはツールバージョン・タスク管理に [mise](https://mise.jdx.dev/) を使用しています。

\`\`\`bash
# ツール(bun, node)のインストール
mise install

# 依存関係のインストール
mise run install

# 開発サーバーの起動
mise run dev
\`\`\`

その他のタスク一覧は `mise tasks` で確認できます(`build` / `lint` / `format` / `preview` / `test` / `test:bun` / `test:ui` / `test:coverage` / `build:wasm`)。

## MoonBitコアの変更

`packages/wasm-core/`配下のMoonBitソースを変更した場合は、[moon CLI](https://www.moonbitlang.com/download/)をインストールした上で以下を実行し、wasmビルド成果物を再生成してコミットする:

\`\`\`bash
mise run build:wasm
\`\`\`
```

- [ ] **Step 2: 差分を確認してコミット**

```bash
git diff README.md
git add README.md
git commit -m "docs: READMEにpackages/構成とMoonBitビルド手順を追記"
```

- [ ] **Step 3: 最終確認(4コマンド + moon test)**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
cd packages/wasm-core && moon test && cd -
```

全て、Task 2完了時点と変わらないこと(ドキュメントのみの変更のため)を確認する。これがPlan 1全体の完了条件。
