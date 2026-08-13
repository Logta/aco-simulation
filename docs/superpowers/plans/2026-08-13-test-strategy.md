# テスト戦略見直し(Plan 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** これまで人手で行っていたブラウザ実地確認(読み込み→描画→開始→クリックで食料追加→フェロモン形成→リセット)をPlaywrightで自動化し、その上でvitest/bun testの二重テストランナー実行を一本化する(vitestを正とし、bun testを廃止)。

**Architecture:** Playwrightのspecはリポジトリ直下`e2e/`に置く(`packages/app/`配下に置くと`bun test`/`vitest`のいずれかが誤って拾ってしまうリスクがあるため — 実機検証済み、後述)。`playwright.config.ts`の`webServer`が`mise run dev`を自動起動してからテストを実行する。bun test廃止はユーザー承認済み(理由: このセッション最大のバグ — Plan Bでの`vi.mock`がBunの共有モジュールレジストリ経由でテストファイル間に漏れた問題 — の根本原因がBunの実行モデルそのものであったため)。

**Tech Stack:** `@playwright/test`(Chromiumのみ)、vitest(唯一のJSユニット/コンポーネントテストランナーとして残す)。

## Global Constraints

- **`e2e/`はリポジトリ直下に置く(`packages/app/`配下に置かない)**: `mise run test`(vitest, `dir = "packages/app"`)と(この計画のTask 1〜2の間はまだ存在する)`mise run test:bun`(bun, `dir = "packages/app"`)はどちらも実行ディレクトリが`packages/app`にスコープされているため、リポジトリ直下の`e2e/`を一切スキャンしないことを実機で確認済み(`packages/app/`配下に置いていた場合、`bun test`が`*.spec.ts`を再帰的に拾ってしまい、Playwrightのテストファイルをbunのテストとして誤実行しようとして壊れるリスクがあった)。
- **`bun`コマンドは必ず`mise`経由で実行する**: 依存関係を操作するコマンド(`bun add`/`bun remove`等)は`mise exec -- bun ...`を必ず経由する。素の`bun`コマンドは`minimumReleaseAge`ゲートを実装していない別バージョンを指している可能性がある(Plan 1の最終レビューで実際に発生した問題)。
- **スクリーンショット比較は「変化した/しない」の粗い判定に留める**: フェロモン濃度やアリの正確な位置をピクセル単位で検証するテストは書かない(乱数に依存し、フレーク要因になる)。「クリック前後でキャンバスのピクセルバッファが変化したか」「一定時間経過後にキャンバスが変化したか」といった真偽判定のみ行う。
- **食料追加のスクリーンショット比較は一時停止中に行う**: 描画ループ(`SimulationCanvas.tsx`の`render`)は`isRunning`の状態に関わらず毎フレーム`getRenderView()`を呼んで再描画するため、シミュレーション実行中はアリの移動そのものがキャンバスを変化させ続け、「クリックによる食料追加が原因でキャンバスが変化した」ことを切り分けられない。アプリ起動直後は`isRunning: false`(初期値)なので、「開始」ボタンを押す前にクリックで食料追加のテストを行う。
- **アリ数スライダーの操作はキーボードで行う(ドラッグ座標に依存しない)**: Radix UIの`Slider`コンポーネントは`role="slider"`を持つ要素(Thumb)に`id`/`aria-label`が伝播しないため(実機検証済み — `id="antCount"`は`SliderPrimitive.Root`に付与されるが、Thumbには伝播しない)、`getByRole("slider", { name: ... })`のようなアクセシブルネームによる特定はできない。代わりに`page.locator("#antCount").locator('[role="slider"]')`でThumb要素を特定し、`.focus()`してから`ArrowRight`キーを押すことで値が変化することを確認する(Radix Sliderはキーボード操作をネイティブサポートしている。実機検証済み: `aria-valuenow`が`50`→`51`に変化することを確認)。
- **4コマンド確認の対象がタスクによって変わる**:
  - Task 1・2: `mise run test`(vitest)、`mise run test:bun`(bun test、この時点ではまだ存在する)、`mise run build`、`mise run lint`、`mise run test:e2e`(Playwright)の**5つ**。
  - Task 3完了後: `test:bun`は廃止されるため存在しなくなる。Task 3・4では`mise run test`、`mise run build`、`mise run lint`、`mise run test:e2e`の**4つ**を確認する。`test:bun`が「存在しない」ことを確認するのであって、実行して失敗を確認するのではない(タスクの一覧に`test:bun`が出てこないことを`mise tasks`で確認する)。
- **lintの期待値**: 全タスクを通じて`mise run lint`は**exit 0(警告なし)**を維持する(Plan 2で初めて達成した状態)。新しい警告が出た場合は必ず対応する。
- **作業はブランチを切って行う**: `main`から新しいブランチ(worktree)を作成してから着手する(既に`aco-test-strategy`worktreeを作成済み — このworktree内で作業する)。
- **既存の実測値(このセッション内で実施済みのスパイクの結果、再検証不要)**:
  - `mise exec -- bun add -D @playwright/test`(ルート)で`@playwright/test@1.62.1`が`minimumReleaseAge`ゲートを正しく通過してインストールされることを確認済み。
  - `mise exec -- bunx playwright install chromium`がゲートの影響を受けずブラウザバイナリをダウンロードできることを確認済み(npm経由ではなくPlaywright独自のダウンローダーのため)。
  - `playwright.config.ts`の`webServer`から`mise run dev`(`cwd: "packages/app"`)を起動し、`http://localhost:5173`への到達を待ってからテストを実行する構成が実機で正常に動作することを確認済み。

---

### Task 1: Playwrightスキャフォールディングとスモークテスト

**Files:**
- Create: `e2e/smoke.spec.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`(`@playwright/test`をdevDependenciesに追加)
- Modify: `mise.toml`(`test:e2e`タスクを追加)
- Modify: `.gitignore`(Playwrightの出力ディレクトリを追加)
- Modify: `.oxlintrc.json` / `.oxfmtrc.json`(Playwrightの出力ディレクトリを`ignorePatterns`に追加)

**Interfaces:**
- Consumes: なし
- Produces: `mise run test:e2e`タスク。以降のタスクはこのタスクを使い続ける。

- [ ] **Step 1: `@playwright/test`をルートのdevDependenciesに追加する**

```bash
mise exec -- bun add -D @playwright/test
```

- [ ] **Step 2: Chromiumのブラウザバイナリをインストールする**

```bash
mise exec -- bunx playwright install chromium
```

- [ ] **Step 3: `playwright.config.ts`を作成する**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  webServer: {
    command: "mise run dev",
    cwd: "packages/app",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    timeout: 30_000,
  },
  use: {
    baseURL: "http://localhost:5173",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 4: `e2e/smoke.spec.ts`を作成する**

```typescript
import { test, expect } from "@playwright/test";

test("読み込みが完了し、キャンバスが表示される", async ({ page }) => {
  await page.goto("/");

  // ローディングメッセージが消えるまで待つ(WASMモジュールの初期化完了を待つ)。
  await expect(page.getByText("シミュレーションエンジンを読み込み中...")).not.toBeVisible({
    timeout: 10_000,
  });

  // エラーメッセージが表示されていないことを確認する。
  await expect(page.getByText("シミュレーションエンジンの読み込みに失敗しました", { exact: false })).not.toBeVisible();

  // キャンバスが描画されている。
  await expect(page.locator("canvas")).toBeVisible();
});
```

- [ ] **Step 5: `mise.toml`に`test:e2e`タスクを追加する**

`mise.toml`の`[tasks."test:coverage"]`ブロックの直後に以下を追加する:

```toml
[tasks."test:e2e"]
description = "Playwrightでブラウザ実地確認を自動実行"
run = "bunx playwright test"
```

(このタスクはルートで実行する — `playwright.config.ts`がルート直下にあり、`webServer`設定内で`packages/app`への`cwd`を自前で指定しているため、タスク自体に`dir`は不要。)

- [ ] **Step 6: `.gitignore`にPlaywrightの出力ディレクトリを追加する**

`.gitignore`の`packages/app/dist-ssr`の行の直後に追加する:

```diff
 packages/app/dist
 packages/app/dist-ssr
+test-results
+playwright-report
+blob-report
 *.local
```

- [ ] **Step 7: `.oxlintrc.json`と`.oxfmtrc.json`の`ignorePatterns`にPlaywrightの出力ディレクトリを追加する**

両ファイルの`ignorePatterns`配列に`"test-results"`と`"playwright-report"`を追加する。`.oxlintrc.json`の例:

```diff
   "ignorePatterns": [
     "packages/app/dist",
     "packages/app/src/routeTree.gen.ts",
-    "packages/wasm-core/_build"
+    "packages/wasm-core/_build",
+    "test-results",
+    "playwright-report"
   ]
```

(`e2e/*.spec.ts`自体はTypeScriptソースとして通常通りlint/format対象にする — 除外しない。)

- [ ] **Step 8: 5コマンドで確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
mise run test:e2e
```

期待結果: `test`・`test:bun`はこれまで通り25/25、両ランナー一致(この計画の`e2e/`追加が両ランナーに一切影響しないことを確認する)。`build`成功。`lint`はexit 0(警告なし)を維持。`test:e2e`は1件パス。

- [ ] **Step 9: コミット**

```bash
git add package.json bun.lock playwright.config.ts e2e/ mise.toml .gitignore .oxlintrc.json .oxfmtrc.json
git commit -m "test: Playwrightを導入しスモークテストを追加"
```

---

### Task 2: 手動確認チェックリストをE2Eテストとして自動化する

**Files:**
- Create: `e2e/simulation.spec.ts`

**Interfaces:**
- Consumes: Task 1の`playwright.config.ts`
- Produces: なし

これまで各Planの完了時にユーザーへ依頼していた手動ブラウザ確認(読み込み→描画→開始→クリックで食料追加→フェロモン形成→リセット→アリ数スライダー操作)を、対応するE2Eテストとして書き起こす。

- [ ] **Step 1: `e2e/simulation.spec.ts`を作成する**

```typescript
import { test, expect } from "@playwright/test";

test.describe("ACOシミュレーション", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("シミュレーションエンジンを読み込み中...")).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test("キャンバスをクリックすると食料が追加され、見た目が変化する(一時停止中)", async ({ page }) => {
    const canvas = page.locator("canvas");
    const before = await canvas.screenshot();

    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvasのboundingBoxが取得できません");
    // アプリ起動直後はisRunning: falseなので、ここではまだ「開始」を押さない
    // (シミュレーション実行中だとアリの移動そのものでキャンバスが変化し続け、
    // クリックによる食料追加が原因かどうかを切り分けられなくなる)。
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(200);

    const after = await canvas.screenshot();
    expect(before.equals(after)).toBe(false);
  });

  test("「開始」を押すとシミュレーションが進行し、キャンバスが時間経過で変化する", async ({ page }) => {
    const canvas = page.locator("canvas");
    const before = await canvas.screenshot();

    await page.getByRole("button", { name: "開始" }).click();
    await page.waitForTimeout(1_000);

    const after = await canvas.screenshot();
    expect(before.equals(after)).toBe(false);

    // ボタンラベルが「一時停止」に切り替わっている。
    await expect(page.getByRole("button", { name: "一時停止" })).toBeVisible();
  });

  test("「リセット」を押してもエラーにならず描画が継続する", async ({ page }) => {
    await page.getByRole("button", { name: "開始" }).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "リセット" }).click();
    await page.waitForTimeout(200);

    // リセット後もキャンバスは表示され続け、エラーメッセージは出ない。
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByText("シミュレーションエンジンの読み込みに失敗しました", { exact: false })).not.toBeVisible();
  });

  test("アリ数スライダーをキーボードで操作すると値が変化する", async ({ page }) => {
    const antSliderThumb = page.locator("#antCount").locator('[role="slider"]');
    await antSliderThumb.focus();

    const before = await antSliderThumb.getAttribute("aria-valuenow");
    await page.keyboard.press("ArrowRight");
    const after = await antSliderThumb.getAttribute("aria-valuenow");

    expect(Number(after)).toBeGreaterThan(Number(before ?? "0"));
  });

  test("「餌を追加」ボタンを押すとキャンバスが変化する", async ({ page }) => {
    const canvas = page.locator("canvas");
    const before = await canvas.screenshot();

    await page.getByRole("button", { name: "餌を追加" }).click();
    await page.waitForTimeout(200);

    const after = await canvas.screenshot();
    expect(before.equals(after)).toBe(false);
  });
});
```

- [ ] **Step 2: 5コマンドで確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
mise run test:e2e
```

期待結果: `test`・`test:bun`は25/25のまま(このタスクは`e2e/`にファイルを追加するのみで、`packages/app/`配下には触れないため)。`build`成功。`lint`はexit 0。`test:e2e`は6件(Task 1の1件 + このタスクの5件)全てパス。

- [ ] **Step 3: コミット**

```bash
git add e2e/simulation.spec.ts
git commit -m "test: 手動確認チェックリストをE2Eテストとして自動化"
```

---

### Task 3: bun testを廃止しvitestに一本化する

**Files:**
- Delete: `packages/app/bunfig.toml`
- Delete: `packages/app/bun-test-setup.ts`
- Modify: `packages/app/package.json`(`test:bun`スクリプトを削除)
- Modify: `mise.toml`(`[tasks."test:bun"]`を削除)
- Modify: `package.json`(ルート、`bun-types`をdevDependenciesから削除)
- Modify: `packages/app/src/hooks/useSimulation.test.ts`(不要になったRAFポリフィルを削除)

**Interfaces:**
- Consumes: なし
- Produces: なし

⚠️ **重要な注意**: ルートの`bunfig.toml`(`[install]`セクション、`minimumReleaseAge`ゲート)は**このタスクで一切触らない**。廃止するのは`packages/app/bunfig.toml`(`[test]`セクションのみを持つファイル)であり、これは別ファイルである。混同しないこと。

- [ ] **Step 1: `packages/app/bunfig.toml`を削除する**

```bash
git rm packages/app/bunfig.toml
```

- [ ] **Step 2: `packages/app/bun-test-setup.ts`を削除する**

```bash
git rm packages/app/bun-test-setup.ts
```

- [ ] **Step 3: `packages/app/package.json`から`test:bun`スクリプトを削除する**

```diff
   "scripts": {
     "dev": "vite",
     "build": "tsc -b && vite build",
     "preview": "vite preview",
     "test": "vitest",
-    "test:bun": "bun test",
     "test:ui": "vitest --ui",
     "test:coverage": "vitest --coverage"
   },
```

- [ ] **Step 4: `mise.toml`から`[tasks."test:bun"]`を削除する**

```diff
 [tasks.test]
 description = "vitest でテストを実行"
 dir = "packages/app"
 run = "bun run test"
 
-[tasks."test:bun"]
-description = "bun test でテストを実行"
-dir = "packages/app"
-run = "bun run test:bun"
-
 [tasks."test:ui"]
```

- [ ] **Step 5: `useSimulation.test.ts`の不要になったRAFポリフィルを削除する**

`packages/app/src/hooks/useSimulation.test.ts`の以下のブロック(bun test実行時にjsdomがRAFを提供しないための回避策で、bun test廃止に伴い不要になる — vitestのjsdom環境は標準でRAF/cancelAnimationFrameを提供する):

```typescript
// bun-test-setup.tsが提供するjsdom環境はrequestAnimationFrame/cancelAnimationFrameを
// globalに公開していないため、このテストファイル内に限定したポリフィルを用意する
// (vitest実行時はjsdom環境が標準で提供するため、未定義の場合のみ設定する)。
if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    return setTimeout(() => callback(Date.now()), 0) as unknown as number;
  }) as typeof requestAnimationFrame;
}
if (typeof globalThis.cancelAnimationFrame === "undefined") {
  globalThis.cancelAnimationFrame = ((handle: number): void => {
    clearTimeout(handle);
  }) as typeof cancelAnimationFrame;
}
```

を削除する。

- [ ] **Step 6: `bun-types`が他に使われていないことを確認してから削除する**

```bash
grep -rn "bun:test\|Bun\." packages/app/src packages/wasm-core/scripts 2>/dev/null
```

期待結果: 何もヒットしない(Step 1〜2で`bun:test`の唯一の利用元を削除済みのため)。ヒットした場合はこのStepをスキップし、レポートにその旨を明記する。

ヒットしなかった場合、ルートのdevDependenciesから`bun-types`を削除する:

```bash
mise exec -- bun remove bun-types
```

- [ ] **Step 7: 確認する**

```bash
mise run test
mise run build
mise run lint
mise run test:e2e
mise tasks
```

期待結果: `mise run test`(vitest)は引き続き25/25パス。`build`成功。`lint`はexit 0。`test:e2e`は6件パス。`mise tasks`の一覧に`test:bun`が**含まれていない**ことを目視確認する。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "refactor: bun testを廃止しvitestに一本化"
```

---

### Task 4: README更新と最終確認

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1〜3の完了
- Produces: なし

- [ ] **Step 1: `README.md`のタスク一覧を更新する**

`README.md`内、以下の行:

```markdown
その他のタスク一覧は `mise tasks` で確認できます(`build` / `lint` / `format` / `preview` / `test` / `test:bun` / `test:ui` / `test:coverage` / `build:wasm`)。
```

を以下に置き換える:

```markdown
その他のタスク一覧は `mise tasks` で確認できます(`build` / `lint` / `format` / `preview` / `test` / `test:ui` / `test:coverage` / `test:e2e` / `build:wasm`)。

`test:e2e`はPlaywrightによるブラウザ実地確認(読み込み→描画→操作)を自動実行する。初回実行前に`mise exec -- bunx playwright install chromium`でブラウザバイナリを取得しておく必要がある(`moon` CLIと同様、npm経由ではなく専用のダウンローダーを使うため、`minimumReleaseAge`ゲートの対象外)。
```

- [ ] **Step 2: 差分を確認してコミット**

```bash
git diff README.md
git add README.md
git commit -m "docs: READMEにtest:e2eタスクとPlaywrightのセットアップ手順を追記"
```

- [ ] **Step 3: 最終確認**

```bash
mise run test
mise run build
mise run lint
mise run test:e2e
cd packages/wasm-core && moon test && cd -
```

期待結果: `test`(vitest)25/25。`build`成功。`lint`はexit 0。`test:e2e`は6件パス。`moon test`は56/56(この計画はMoonBitコードに触れていないため変化なし)。これがPlan 3全体の完了条件。
