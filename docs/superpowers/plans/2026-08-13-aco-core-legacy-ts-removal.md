# ACOコア: 旧TS実装削除(Plan C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WASM移植(Plan A)とJS側統合(Plan B)によって本番経路から使われなくなった`src/lib/aco/`配下の旧TS実装(アルゴリズム本体・テスト計17ファイル)を、パリティ確認のうえで削除する。

**Architecture:** 変更は追加ではなく削除・整理のみ。`src/lib/aco/`から本番コードが今も使っているのは`Position`型だけであり、これを`src/lib/aco-wasm/adapter.ts`に移設したうえでディレクトリ全体を削除する。テスト戦略・振る舞いの変更は一切行わない。

**Tech Stack:** TypeScript, Vitest, Bun test, oxlint, MoonBit(`moon test`)。

## Global Constraints

- **パリティ確認の定義**: MoonBit側は既にPhase 0のTSテストテーブルを「仕様」としてポートされており(Plan A)、乱数生成器がTS版(非MT19937)とMoonBit版(MT19937)で異なるため、フレーム単位の軌跡一致は原理的に不可能かつ狙いではない。パリティ確認とは「Phase 0で作成した7つのTSテストファイルそれぞれに対応するMoonBit側の`*_test.mbt`が存在し、既知の意図的な乖離(2件、下記)を除いて同じ入出力仕様を検証していること」を確認する**テーブル監査**であり、実行時トラジェクトリ比較のハーネスを新たに作ることではない。
- **既知の意図的な乖離(裁定済み、再確認不要・再オープン禁止)**:
  1. `find_nearest_food_index`(MoonBit)は最近傍の食料を選ぶ。TS版`ant-behavior.ts`は`array.find()`で配列順の最初の1件を選ぶ(偶発的な実装詳細と判断済み)。
  2. `execute_returning_behavior`(MoonBit)は同一フレーム内で複数アリが同一セルにフェロモンを付与する場合、全アリ分を加算する。TS版は最後の1匹分しか残らない(last-write-wins、TS側のバグと判断済み)。
- **4コマンド確認を全タスク境界で徹底**: `mise run test`(vitest)、`mise run test:bun`(bun native)、`mise run build`、`mise run lint`の**4つ全て**を各タスック完了時に実行して結果を報告する。Plan Bでは`test:bun`のみを見落として2件のバグが最終確認まで見逃された。同じ抜けを繰り返さないこと。
- **lintの期待値**: `mise run lint`(oxlint)は`src/hooks/useSimulation.ts`の`react-hooks(exhaustive-deps)`エラー1件で**exit 1**になるのが正常。これはこのブランチの既知の状態(Plan Bで裁定済み)であり、削除タスクの範囲外。この警告を修正・抑制(eslint-disable等)しようとしないこと。
- **テスト件数は構造で判断する**: 現在の10ファイル105テスト(vitest/bun両方)のうち、削除対象は`src/lib/aco/`配下の7テストファイル(`geometry.test.ts`/`movement.test.ts`/`collision.test.ts`/`pheromone.test.ts`/`pathfinding.test.ts`/`ant-behavior.test.ts`/`simulation-engine.test.ts`)。具体的な残数を先に決め打ちせず、削除後に「vitestとbun testの結果件数(ファイル数・テスト数)が一致し、両方0失敗であること」を確認する。
- **作業はブランチを切って行う**: `feat/mise-setup`から新しいブランチ(worktree)を作成してから着手する。Phase 0・Plan A・Plan Bと同じ運用。
- **本計画のスコープ外**: Plan B最終レビューで既に裁定済み・保留(parked)扱いのMinor指摘(RAFループの早期returnがrAFを再スケジュールしない件、`instantiateStreaming`のフォールバック欠如、`nest`オブジェクトの参照共有、world寸法の重複定義)はこの計画では一切触らない。これらはPlan Cの範囲外であり、対応するならユーザーへの別途確認が必要。

---

### Task 1: パリティ監査(削除前の最終確認)

**Files:**
- 読むだけ(変更なし): `src/lib/aco/*.test.ts`(7ファイル)、`moonbit/aco_core/*_test.mbt`(8ファイル)、`moonbit/aco_core/ant_behavior.mbt`、`moonbit/aco_core/pathfinding.mbt`
- Create: `docs/superpowers/plans/2026-08-13-aco-core-legacy-ts-removal-parity-audit.md`(監査結果を記録する短いメモ)

**Interfaces:**
- Consumes: なし(読み取りのみ)
- Produces: 監査メモのファイルパス(Task 2以降はこれを前提に進めてよい)

対応表(このタスクで埋めるべきマッピング。各行についてMoonBit側のテストファイルを開き、TS版のテストケースがカバーする入出力仕様が同じ意味でカバーされているかをざっと確認する。完全一致の逐一比較ではなく、「テストされている関数・境界条件の集合が対応しているか」の監査でよい):

| TS版テストファイル(Phase 0) | 対応するMoonBit版テストファイル(Plan A) | 対象関数 |
|---|---|---|
| `src/lib/aco/geometry.test.ts` | `moonbit/aco_core/geometry_test.mbt` | `torusDistance`/`torusWrap`/`normalizeAngle` |
| `src/lib/aco/movement.test.ts` | `moonbit/aco_core/movement_test.mbt` | `moveAnt`/`moveTowardsTarget`/`moveWithBias` |
| `src/lib/aco/collision.test.ts` | `moonbit/aco_core/collision_test.mbt` | `avoidCollisions` |
| `src/lib/aco/pheromone.test.ts` | `moonbit/aco_core/pheromone_test.mbt` | `depositPheromone`/`decayPheromones`/`getPheromoneStrength` |
| `src/lib/aco/pathfinding.test.ts` | `moonbit/aco_core/pathfinding_test.mbt` | `followPheromone`/`findNearestTarget`/`getTargetsInRadius` (※`find_nearest_food_index`の乖離は上記Global Constraintsの通り既知・裁定済み) |
| `src/lib/aco/ant-behavior.test.ts` | `moonbit/aco_core/ant_behavior_test.mbt` | アリ1匹分の行動決定 (※フェロモン加算の乖離は上記Global Constraintsの通り既知・裁定済み) |
| `src/lib/aco/simulation-engine.test.ts` | `moonbit/aco_core/step_test.mbt` | 1フレーム分のステップ実行(`executeSimulationStep` ⇔ `step`) |

(`mt19937_test.mbt`はTS側に対応するファイルがない — MT19937はMoonBit移植で新規採用した乱数生成器であり、TS版の乱数生成器の代替ではなく仕様上の意図的な変更のため、対応表には含めない。)

- [ ] **Step 1: 対応表を実際に埋める**

上記7行それぞれについて、TS版テストファイルとMoonBit版テストファイルを両方開き、テストされている関数・境界条件(0除算、範囲外、境界値など)の集合がおおよそ対応していることを確認する。対応が取れていない・MoonBit側に明らかなテストの抜けがある場合は、そのテストケースの内容をメモに記録する(このタスクでは追加実装はしない — 発見のみ)。

- [ ] **Step 2: 食料枯渇の動作をメモに記録する**

このセッションで既に実施済みの検証結果(WASM側で食料3個・amount=5ずつを3フレーム以内に全て枯渇・削除できることを実測確認済み)を、パリティ監査メモの一項目として明記する。追加の実装や検証は不要 — 既に確認済みの結果を記録するだけ。

- [ ] **Step 3: 監査メモを書く**

`docs/superpowers/plans/2026-08-13-aco-core-legacy-ts-removal-parity-audit.md`に以下を書く:
- 対応表(Step 1の結果、各行に✅/⚠️と一言コメント)
- 既知の意図的な乖離2件(上記Global Constraintsからそのまま転記)
- 食料枯渇の実測結果(Step 2)
- 総合判定: 「削除を進めてよい」か「削除前に対応すべき懸念がある」か

- [ ] **Step 4: 総合判定が「削除を進めてよい」であることを確認してコミット**

⚠️ 判定が「削除前に対応すべき懸念がある」だった場合はこのタスクをBLOCKEDとして報告し、後続タスクを実行しない。

```bash
git add docs/superpowers/plans/2026-08-13-aco-core-legacy-ts-removal-parity-audit.md
git commit -m "docs: 旧TS実装削除前のパリティ監査メモを追加"
```

---

### Task 2: `Position`型を`adapter.ts`へ移設

**Files:**
- Modify: `src/lib/aco-wasm/adapter.ts:1`(先頭のimport文を型定義に置き換え)
- Modify: `src/stores/simulation.store.ts:1-10`(import文を統合)
- Modify: `src/components/ACOSimulation/SimulationCanvas.tsx:1-4`(import文を統合)

**Interfaces:**
- Consumes: なし
- Produces: `export type Position = { x: number; y: number };`(`src/lib/aco-wasm/adapter.ts`からエクスポート)。Task 3で`src/lib/aco/types.ts`を削除する前提。

現状、`Position`型は`src/lib/aco/types.ts`で`zod`スキーマ(`PositionSchema`)から`z.infer`で導出されているが、`PositionSchema`自体はランタイムで一切使われていない(型としてのみ使用)。移設先では素のTypeScript型として定義し、zod依存を持ち込まない。

- [ ] **Step 1: `adapter.ts`の先頭を書き換える**

`src/lib/aco-wasm/adapter.ts`の1行目:

```ts
import type { Position } from "@/lib/aco/types";
```

を、以下に置き換える:

```ts
export type Position = { x: number; y: number };
```

- [ ] **Step 2: `simulation.store.ts`のimportを統合する**

`src/stores/simulation.store.ts`の現在の先頭:

```ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Position } from "../lib/aco/types";
import {
  initializeSimulation as adapterInitializeSimulation,
  reinitializeAnts,
  addFood as adapterAddFood,
  addRandomFoods as adapterAddRandomFoods,
  resetAll,
} from "../lib/aco-wasm/adapter";
```

を、以下に置き換える(`Position`を同じ`adapter`importの型importとして合流させる):

```ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  initializeSimulation as adapterInitializeSimulation,
  reinitializeAnts,
  addFood as adapterAddFood,
  addRandomFoods as adapterAddRandomFoods,
  resetAll,
} from "../lib/aco-wasm/adapter";
import type { Position } from "../lib/aco-wasm/adapter";
```

(値importと型importを分けているのは、既存コードの型import分離スタイルに合わせるため。`import { ... } from "../lib/aco-wasm/adapter"`に`import type { Position }`を1行で合流させる書き方でも構わないが、既存のimport順序・スタイルを崩さないことを優先する。)

- [ ] **Step 3: `SimulationCanvas.tsx`のimportを統合する**

`src/components/ACOSimulation/SimulationCanvas.tsx`の現在の先頭:

```tsx
import { useEffect, useRef, useCallback } from "react";
import { useSimulationStore } from "@/stores/simulation.store";
import { getRenderView } from "@/lib/aco-wasm/adapter";
import type { Position } from "@/lib/aco/types";
```

を、以下に置き換える:

```tsx
import { useEffect, useRef, useCallback } from "react";
import { useSimulationStore } from "@/stores/simulation.store";
import { getRenderView } from "@/lib/aco-wasm/adapter";
import type { Position } from "@/lib/aco-wasm/adapter";
```

- [ ] **Step 4: 4コマンドで確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
```

期待結果: `test`・`test:bun`は現状のまま全件パス(105/105、両ランナーとも)、`build`は成功、`lint`は`useSimulation.ts`の既知の警告1件のみでexit 1(Global Constraintsの通り、想定内・対応不要)。この時点では`src/lib/aco/types.ts`はまだ削除しない(まだ他の削除対象ファイルから参照されている可能性があるため、Task 3でまとめて確認・削除する)。

- [ ] **Step 5: コミット**

```bash
git add src/lib/aco-wasm/adapter.ts src/stores/simulation.store.ts src/components/ACOSimulation/SimulationCanvas.tsx
git commit -m "refactor: Position型をadapter.tsに移設しlib/aco/types.tsへの依存を断つ"
```

---

### Task 3: `src/lib/aco/`ディレクトリと未使用依存の削除

**Files:**
- Delete: `src/lib/aco/geometry.ts`, `src/lib/aco/geometry.test.ts`
- Delete: `src/lib/aco/movement.ts`, `src/lib/aco/movement.test.ts`
- Delete: `src/lib/aco/collision.ts`, `src/lib/aco/collision.test.ts`
- Delete: `src/lib/aco/pheromone.ts`, `src/lib/aco/pheromone.test.ts`
- Delete: `src/lib/aco/pathfinding.ts`, `src/lib/aco/pathfinding.test.ts`
- Delete: `src/lib/aco/ant-behavior.ts`, `src/lib/aco/ant-behavior.test.ts`
- Delete: `src/lib/aco/simulation-engine.ts`, `src/lib/aco/simulation-engine.test.ts`
- Delete: `src/lib/aco/ant.ts`
- Delete: `src/lib/aco/constants.ts`
- Delete: `src/lib/aco/types.ts`
- Modify: `package.json`(`zod`依存を削除。Task 2完了後の時点で`src`配下に`zod`の利用者がいないことを前提とする — Step 1で必ず再確認すること)

**Interfaces:**
- Consumes: Task 2で`Position`型が`src/lib/aco-wasm/adapter.ts`へ移設済みであること
- Produces: なし(このタスクで公開interfaceは増減しない)

- [ ] **Step 1: 削除前に参照が残っていないことを確認する**

```bash
grep -rn "lib/aco/" src --include="*.ts" --include="*.tsx"
```

期待結果: 何もヒットしない(Task 2の変更が正しく行われていれば、`src/lib/aco-wasm/`や`src/lib/aco/`自身以外に参照は残っていないはず)。ヒットした場合は削除を進めず、その参照先を先に直す。

```bash
grep -rln "from ['\"]zod" src --include="*.ts" --include="*.tsx"
```

期待結果: `src/lib/aco/types.ts`のみ(このファイル自体を削除するため、削除後は`zod`の利用者がゼロになる)。他のファイルがヒットした場合、`package.json`から`zod`を削除するステップ(Step 3)はスキップする。

- [ ] **Step 2: ディレクトリを削除する**

```bash
git rm -r src/lib/aco
```

- [ ] **Step 3: `zod`依存を削除する(Step 1で他利用者がいないと確認できた場合のみ)**

```bash
bun remove zod
```

- [ ] **Step 4: 4コマンドで確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
```

期待結果:
- `mise run test`(vitest)・`mise run test:bun`(bun test)ともに、削除した7テストファイル分が消え、**両ランナーで一致するファイル数・テスト数**、全件パス、0失敗。
- `mise run build`成功。
- `mise run lint`は`useSimulation.ts`の既知の警告1件のみでexit 1(Global Constraintsの通り)。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "refactor: WASM移行に伴い旧TS実装(src/lib/aco/)とzod依存を削除"
```

---

### Task 4: 設計specの状態更新

**Files:**
- Modify: `docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md`

**Interfaces:**
- Consumes: Task 1〜3の完了
- Produces: なし(ドキュメントのみ)

- [ ] **Step 1: spec内の「移行順序(概要)」セクションを更新する**

`docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md`内、「## 移行順序(概要)」セクションの末尾にある

```
8. パリティ確認 → 旧TS実装削除
```

の行を、完了を示す形に更新する(既存の他ステップが「— 完了」を末尾に付けているスタイルに合わせる):

```
8. パリティ確認 → 旧TS実装削除 — 完了(Plan C: `docs/superpowers/plans/2026-08-13-aco-core-legacy-ts-removal.md`)
```

- [ ] **Step 2: 「既存TS実装の扱い」セクションに完了の一文を追記する**

`## 既存TS実装の扱い`セクションの本文(「パリティ確認後に削除する。二重実装を恒久的に残さず、シンプルに保つ。」)の直後に1行追加する:

```
(2026-08-13時点でPlan Cにより削除完了。`Position`型は`src/lib/aco-wasm/adapter.ts`に移設。)
```

- [ ] **Step 3: 差分を確認してコミット**

```bash
git diff docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md
git add docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md
git commit -m "docs: Plan C(旧TS実装削除)完了をspecに反映"
```

- [ ] **Step 4: 最終確認**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
```

4コマンド全ての結果が、Task 3完了時点と変わらないこと(ドキュメントのみの変更のため)を確認する。これがPlan C全体の完了条件。
