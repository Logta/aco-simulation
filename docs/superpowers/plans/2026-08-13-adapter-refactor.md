# adapter.ts分割 + 保留指摘回収(Plan 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `packages/app/src/lib/aco-wasm/adapter.ts`(388行)を責務ごとのファイルに分割し、Plan Bの最終レビューで保留(parked)されていた指摘のうち、adapter/UI側で対応可能な4件を回収する。

**Architecture:** `adapter.ts`は公開API(`loadAdapter`/`loadAdapterFromBytes`/`initializeSimulation`/`reinitializeAnts`/`addFood`/`addRandomFoods`/`resetAll`/`getRenderView`/`stepSimulation`/`decaySimulation`/`Position`/`SimulationInitConfig`/`RenderView`/`StepConfig`型)を再エクスポートするバレルファイルとして残し、実装を5つの内部モジュールに分割する。**この方式により、6つの既存consumerファイル(`simulation.store.ts`/`simulation.store.test.ts`/`SimulationCanvas.tsx`/`index.tsx`/`useSimulation.ts`/`useSimulation.test.ts`)のimport文は一切変更不要**(すべて`"...lib/aco-wasm/adapter"`または同ディレクトリの`"./adapter"`からimportし続ける)。

**Tech Stack:** TypeScript, React, WebAssembly。

## Global Constraints

- **振る舞い凍結の範囲を明示する**: Task 1(ファイル分割)は挙動を一切変更しない(振る舞い凍結)。Task 2〜4は意図的な挙動変更(バグ修正)であり、それぞれ何を・なぜ変えるかをタスク内で明示する。
- **回収する保留指摘(Plan B最終レビューで`parked`と記録された5件のうち4件)**:
  1. `SimulationCanvas.tsx`のRAFループの早期returnが再スケジュールしない(Task 3)
  2. `loadAdapter`の`instantiateStreaming`にフォールバックがない(Task 2)
  3. `nest`オブジェクトの参照共有(アダプタ内部状態とZustandストアが同じオブジェクト参照を共有している)(Task 2)
  4. `index.tsx`がworld寸法(800×600)をハードコードしており、ストアの`worldWidth`/`worldHeight`と重複定義になっている(Task 3)
- **この計画で回収しない保留指摘(意図的にスコープ外)**: 「同一フレーム内の複数アリによる過剰採取」(`find_nearest_food_index`が`food_amount <= 0`をスキップしない)は、MoonBit側(`packages/wasm-core/pathfinding.mbt`)のシミュレーションロジック自体を変更する必要があり、adapter/UI側のリファクタリングというこの計画のスコープを超える。この計画では一切触らない。
- **`useSimulation.ts`のexhaustive-deps警告(Task 4)**: これまでのPlanでは「既知・対応不要」として扱われてきたが、この計画はアーキテクチャ見直しの一環として明示的にこの警告を*正しく解消する*(`eslint-disable`等での抑制ではなく、`useEffect`が`animate`に依存する構造そのものを直す)。既存の振る舞い(アリの移動・フェロモン処理のタイミング)を変えないことを最優先し、Step内で挙動の同一性を具体的に説明する。
- **4コマンド確認を全タスク境界で徹底**: `mise run test`(vitest)、`mise run test:bun`(bun native)、`mise run build`、`mise run lint`の4つ全てをタスク完了時に実行して結果を報告する。
- **lintの期待値の変化**: Task 4完了後は、`useSimulation.ts`の既知の警告が解消されるため、`mise run lint`は**exit 0(警告なし)になることを期待する**。Task 1〜3の時点では引き続きexit 1(既知の警告のみ)が正常。
- **`bun`コマンドは必ず`mise`経由で実行する**: 依存関係を操作するコマンド(`bun install`/`bun update`/`bun add`等)は`mise exec -- bun ...`または`mise run <task>`を必ず経由する。素の`bun`コマンドは`minimumReleaseAge`ゲートを実装していない別バージョンを指している可能性がある(Plan 1の最終レビューで実際に発生した問題)。この計画は依存関係を変更しないため通常は該当しないが、念のため徹底する。
- **作業はブランチを切って行う**: `main`から新しいブランチ(worktree)を作成してから着手する(既に`aco-adapter-refactor`worktreeを作成済み — このworktree内で作業する)。

---

### Task 1: adapter.tsを責務別に5ファイルへ分割する(振る舞い凍結)

**Files:**
- Create: `packages/app/src/lib/aco-wasm/wasm-types.ts`
- Create: `packages/app/src/lib/aco-wasm/state.ts`
- Create: `packages/app/src/lib/aco-wasm/loader.ts`
- Create: `packages/app/src/lib/aco-wasm/population.ts`
- Create: `packages/app/src/lib/aco-wasm/render.ts`
- Create: `packages/app/src/lib/aco-wasm/step.ts`
- Modify: `packages/app/src/lib/aco-wasm/adapter.ts`(公開APIを再エクスポートするバレルに置き換え)

**Interfaces:**
- Consumes: なし
- Produces: 内部モジュール間のインターフェース。`state.ts`が`getState()`/`setState()`/`f64()`/`u8()`/`CELL_SIZE`を公開し、`loader.ts`/`population.ts`/`render.ts`/`step.ts`がそれを利用する。これらの内部関数は`adapter.ts`からは再エクスポート**しない**(公開APIではない)。

この分割はコードの移動のみで、ロジックは一切変更しない(1文字も変えずに元のコードをそのまま該当ファイルに配置する)。

- [ ] **Step 1: `wasm-types.ts`を作成する(型定義のみ)**

```typescript
export type Position = { x: number; y: number };

export type WasmExports = {
  memory: WebAssembly.Memory;
  step: (
    rng: number,
    antX: number,
    antY: number,
    antDirection: number,
    antHasFood: number,
    antTargetFoodIndex: number,
    antFoodAmount: number,
    antCount: number,
    foodX: number,
    foodY: number,
    foodAmount: number,
    foodCount: number,
    pheromoneToFood: number,
    pheromoneToNest: number,
    gridWidth: number,
    gridHeight: number,
    nestX: number,
    nestY: number,
    worldWidth: number,
    worldHeight: number,
    pheromoneDepositAmount: number,
    pheromoneTrackingStrength: number,
  ) => void;
  decay: (pheromoneToFood: number, pheromoneToNest: number, decayRate: number) => void;
  rng_create: (seed: number) => number;
  alloc_f64: (len: number) => number;
  alloc_i32: (len: number) => number;
  alloc_u8: (len: number) => number;
};

export type AntPointers = {
  x: number;
  y: number;
  direction: number;
  hasFood: number;
  targetFoodIndex: number;
  foodAmount: number;
};

export type FoodPointers = {
  x: number;
  y: number;
  amount: number;
};

export type PheromonePointers = {
  toFood: number;
  toNest: number;
};

export type AdapterState = {
  wasm: WasmExports;
  rngPtr: number;
  antCount: number;
  ant: AntPointers;
  foodCount: number;
  food: FoodPointers;
  gridWidth: number;
  gridHeight: number;
  pheromone: PheromonePointers;
  worldWidth: number;
  worldHeight: number;
  nest: Position;
};
```

- [ ] **Step 2: `state.ts`を作成する(モジュール状態・共有ヘルパー)**

```typescript
import type { AdapterState } from "./wasm-types";

export const CELL_SIZE = 10;

let state: AdapterState | null = null;

export const getState = (): AdapterState => {
  if (!state) {
    throw new Error("adapter is not initialized: call loadAdapter() first");
  }
  return state;
};

export const setState = (newState: AdapterState): void => {
  state = newState;
};

export const f64 = (ptr: number, len: number): Float64Array =>
  new Float64Array(getState().wasm.memory.buffer, ptr, len);

export const u8 = (ptr: number, len: number): Uint8Array =>
  new Uint8Array(getState().wasm.memory.buffer, ptr, len);
```

- [ ] **Step 3: `loader.ts`を作成する(WASMロード)**

```typescript
import type { AdapterState, WasmExports } from "./wasm-types";
import { setState } from "./state";

const instantiate = async (bytes: ArrayBuffer): Promise<WasmExports> => {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports as unknown as WasmExports;
};

const instantiateStreamingFrom = async (response: Response): Promise<WasmExports> => {
  const { instance } = await WebAssembly.instantiateStreaming(response, {});
  return instance.exports as unknown as WasmExports;
};

/** 本番用: Viteが解決した`.wasm`のURLからロードする。 */
export const loadAdapter = async (wasmUrl: URL): Promise<void> => {
  const response = await fetch(wasmUrl);
  const wasm = await instantiateStreamingFrom(response);
  setState(createEmptyState(wasm));
};

/** テスト用: 既に読み込んだバイト列からロードする。 */
export const loadAdapterFromBytes = async (bytes: ArrayBuffer): Promise<void> => {
  const wasm = await instantiate(bytes);
  setState(createEmptyState(wasm));
};

const createEmptyState = (wasm: WasmExports): AdapterState => ({
  wasm,
  rngPtr: 0,
  antCount: 0,
  ant: { x: 0, y: 0, direction: 0, hasFood: 0, targetFoodIndex: 0, foodAmount: 0 },
  foodCount: 0,
  food: { x: 0, y: 0, amount: 0 },
  gridWidth: 0,
  gridHeight: 0,
  pheromone: { toFood: 0, toNest: 0 },
  worldWidth: 0,
  worldHeight: 0,
  nest: { x: 0, y: 0 },
});
```

(この時点では`instantiateStreamingFrom`のフォールバック追加は行わない — Task 2で扱う。ここでは元のコードをそのまま移すだけ。)

- [ ] **Step 4: `population.ts`を作成する(アリ・食料の構造変化)**

```typescript
import type { Position } from "./wasm-types";
import { getState, f64, CELL_SIZE } from "./state";

export type SimulationInitConfig = {
  antCount: number;
  nest: Position;
  worldWidth: number;
  worldHeight: number;
};

/**
 * アリ・フェロモングリッド・乱数・食料(空)を初期化する。アプリ起動時に1回だけ呼ぶ。
 */
export const initializeSimulation = (config: SimulationInitConfig): void => {
  const s = getState();
  const { wasm } = s;
  const gridWidth = Math.floor(config.worldWidth / CELL_SIZE);
  const gridHeight = Math.floor(config.worldHeight / CELL_SIZE);
  const gridCells = gridWidth * gridHeight;

  // 確保はビューを張る前に全て終わらせる(grow が既存ビューをdetachしうるため)。
  const antXPtr = wasm.alloc_f64(config.antCount);
  const antYPtr = wasm.alloc_f64(config.antCount);
  const antDirPtr = wasm.alloc_f64(config.antCount);
  const antHasFoodPtr = wasm.alloc_u8(config.antCount);
  const antTargetPtr = wasm.alloc_i32(config.antCount);
  const antFoodAmountPtr = wasm.alloc_f64(config.antCount);
  const foodXPtr = wasm.alloc_f64(0);
  const foodYPtr = wasm.alloc_f64(0);
  const foodAmountPtr = wasm.alloc_f64(0);
  const pheromoneToFoodPtr = wasm.alloc_f64(gridCells);
  const pheromoneToNestPtr = wasm.alloc_f64(gridCells);
  const rngPtr = wasm.rng_create(Math.floor(Math.random() * 0xffffffff));

  const x = new Float64Array(wasm.memory.buffer, antXPtr, config.antCount);
  const y = new Float64Array(wasm.memory.buffer, antYPtr, config.antCount);
  const direction = new Float64Array(wasm.memory.buffer, antDirPtr, config.antCount);
  const hasFood = new Uint8Array(wasm.memory.buffer, antHasFoodPtr, config.antCount);
  const targetFoodIndex = new Int32Array(wasm.memory.buffer, antTargetPtr, config.antCount);
  const foodAmount = new Float64Array(wasm.memory.buffer, antFoodAmountPtr, config.antCount);

  for (let i = 0; i < config.antCount; i++) {
    x[i] = config.nest.x;
    y[i] = config.nest.y;
    direction[i] = Math.random() * Math.PI * 2;
    hasFood[i] = 0;
    targetFoodIndex[i] = -1;
    foodAmount[i] = -1;
  }

  s.rngPtr = rngPtr;
  s.antCount = config.antCount;
  s.ant = {
    x: antXPtr,
    y: antYPtr,
    direction: antDirPtr,
    hasFood: antHasFoodPtr,
    targetFoodIndex: antTargetPtr,
    foodAmount: antFoodAmountPtr,
  };
  s.foodCount = 0;
  s.food = { x: foodXPtr, y: foodYPtr, amount: foodAmountPtr };
  s.gridWidth = gridWidth;
  s.gridHeight = gridHeight;
  s.pheromone = { toFood: pheromoneToFoodPtr, toNest: pheromoneToNestPtr };
  s.worldWidth = config.worldWidth;
  s.worldHeight = config.worldHeight;
  s.nest = config.nest;
};

/**
 * アリだけを再生成し、フェロモングリッドをクリアする。食料は変更しない。
 * フェロモングリッドは既存のポインタをそのまま使い回し、内容をゼロクリアするだけに留める
 * (グリッドサイズはアリ数に依存しないため再確保は不要。スライダー操作のように高頻度に
 * 呼ばれる場合でもWASM線形メモリのリークを最小限に抑える)。
 */
export const reinitializeAnts = (antCount: number): void => {
  const s = getState();
  const { wasm } = s;
  const gridCells = s.gridWidth * s.gridHeight;

  const antXPtr = wasm.alloc_f64(antCount);
  const antYPtr = wasm.alloc_f64(antCount);
  const antDirPtr = wasm.alloc_f64(antCount);
  const antHasFoodPtr = wasm.alloc_u8(antCount);
  const antTargetPtr = wasm.alloc_i32(antCount);
  const antFoodAmountPtr = wasm.alloc_f64(antCount);

  const x = new Float64Array(wasm.memory.buffer, antXPtr, antCount);
  const y = new Float64Array(wasm.memory.buffer, antYPtr, antCount);
  const direction = new Float64Array(wasm.memory.buffer, antDirPtr, antCount);
  const hasFood = new Uint8Array(wasm.memory.buffer, antHasFoodPtr, antCount);
  const targetFoodIndex = new Int32Array(wasm.memory.buffer, antTargetPtr, antCount);
  const foodAmount = new Float64Array(wasm.memory.buffer, antFoodAmountPtr, antCount);

  for (let i = 0; i < antCount; i++) {
    x[i] = s.nest.x;
    y[i] = s.nest.y;
    direction[i] = Math.random() * Math.PI * 2;
    hasFood[i] = 0;
    targetFoodIndex[i] = -1;
    foodAmount[i] = -1;
  }

  // 新規確保はせず、既存のフェロモングリッドをその場でゼロクリアする(ポインタは不変)。
  f64(s.pheromone.toFood, gridCells).fill(0);
  f64(s.pheromone.toNest, gridCells).fill(0);

  s.antCount = antCount;
  s.ant = {
    x: antXPtr,
    y: antYPtr,
    direction: antDirPtr,
    hasFood: antHasFoodPtr,
    targetFoodIndex: antTargetPtr,
    foodAmount: antFoodAmountPtr,
  };
};

/** 食料を1件追加する(生存中の食料はそのまま新しい配列にコピーする)。 */
export const addFood = (position: Position, amount = 100): void => {
  const s = getState();
  const { wasm } = s;
  const newCount = s.foodCount + 1;

  const newXPtr = wasm.alloc_f64(newCount);
  const newYPtr = wasm.alloc_f64(newCount);
  const newAmountPtr = wasm.alloc_f64(newCount);

  const newX = new Float64Array(wasm.memory.buffer, newXPtr, newCount);
  const newY = new Float64Array(wasm.memory.buffer, newYPtr, newCount);
  const newAmount = new Float64Array(wasm.memory.buffer, newAmountPtr, newCount);

  if (s.foodCount > 0) {
    newX.set(f64(s.food.x, s.foodCount));
    newY.set(f64(s.food.y, s.foodCount));
    newAmount.set(f64(s.food.amount, s.foodCount));
  }
  newX[s.foodCount] = position.x;
  newY[s.foodCount] = position.y;
  newAmount[s.foodCount] = amount;

  s.food = { x: newXPtr, y: newYPtr, amount: newAmountPtr };
  s.foodCount = newCount;
};

/** ランダムな位置・量の食料をまとめて追加する。 */
export const addRandomFoods = (count: number): void => {
  const s = getState();
  for (let i = 0; i < count; i++) {
    addFood(
      { x: Math.random() * s.worldWidth, y: Math.random() * s.worldHeight },
      50 + Math.random() * 100,
    );
  }
};

/** 全てを初期状態に戻す(食料も含む)。 */
export const resetAll = (config: SimulationInitConfig): void => {
  initializeSimulation(config);
};
```

(この時点では`s.nest = config.nest`の参照共有修正は行わない — Task 2で扱う。ここでは元のコードをそのまま移すだけ。)

- [ ] **Step 5: `render.ts`を作成する(描画用ビュー)**

```typescript
import type { Position } from "./wasm-types";
import { getState, f64, u8, CELL_SIZE } from "./state";

export type RenderView = {
  antX: Float64Array;
  antY: Float64Array;
  antDirection: Float64Array;
  antHasFood: Uint8Array;
  antCount: number;
  foodX: Float64Array;
  foodY: Float64Array;
  foodAmount: Float64Array;
  foodCount: number;
  pheromoneToFood: Float64Array;
  pheromoneToNest: Float64Array;
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  nest: Position;
};

/** 描画用のゼロコピービューを返す。呼び出しのたびに新しいビューを作る。 */
export const getRenderView = (): RenderView => {
  const s = getState();
  return {
    antX: f64(s.ant.x, s.antCount),
    antY: f64(s.ant.y, s.antCount),
    antDirection: f64(s.ant.direction, s.antCount),
    antHasFood: u8(s.ant.hasFood, s.antCount),
    antCount: s.antCount,
    foodX: f64(s.food.x, s.foodCount),
    foodY: f64(s.food.y, s.foodCount),
    foodAmount: f64(s.food.amount, s.foodCount),
    foodCount: s.foodCount,
    pheromoneToFood: f64(s.pheromone.toFood, s.gridWidth * s.gridHeight),
    pheromoneToNest: f64(s.pheromone.toNest, s.gridWidth * s.gridHeight),
    gridWidth: s.gridWidth,
    gridHeight: s.gridHeight,
    cellSize: CELL_SIZE,
    nest: s.nest,
  };
};
```

- [ ] **Step 6: `step.ts`を作成する(フレーム進行・減衰)**

```typescript
import { getState, f64 } from "./state";

const compactFoodAfterStep = (): void => {
  const s = getState();
  if (s.foodCount === 0) return;

  const amount = f64(s.food.amount, s.foodCount);
  const x = f64(s.food.x, s.foodCount);
  const y = f64(s.food.y, s.foodCount);

  let writeIndex = 0;
  for (let readIndex = 0; readIndex < s.foodCount; readIndex++) {
    if (amount[readIndex] > 0) {
      if (writeIndex !== readIndex) {
        x[writeIndex] = x[readIndex];
        y[writeIndex] = y[readIndex];
        amount[writeIndex] = amount[readIndex];
      }
      writeIndex++;
    }
  }
  s.foodCount = writeIndex;
};

export type StepConfig = {
  pheromoneDepositAmount: number;
  pheromoneTrackingStrength: number;
};

/** 1フレーム分のシミュレーションを進める。食料の枯渇分をその場で圧縮する。 */
export const stepSimulation = (config: StepConfig): void => {
  const s = getState();
  const { wasm } = s;
  wasm.step(
    s.rngPtr,
    s.ant.x,
    s.ant.y,
    s.ant.direction,
    s.ant.hasFood,
    s.ant.targetFoodIndex,
    s.ant.foodAmount,
    s.antCount,
    s.food.x,
    s.food.y,
    s.food.amount,
    s.foodCount,
    s.pheromone.toFood,
    s.pheromone.toNest,
    s.gridWidth,
    s.gridHeight,
    s.nest.x,
    s.nest.y,
    s.worldWidth,
    s.worldHeight,
    config.pheromoneDepositAmount,
    config.pheromoneTrackingStrength,
  );
  compactFoodAfterStep();
};

/** フェロモンを減衰させる(呼び出し側が一定間隔で呼ぶ)。 */
export const decaySimulation = (decayRate: number): void => {
  const s = getState();
  s.wasm.decay(s.pheromone.toFood, s.pheromone.toNest, decayRate);
};
```

- [ ] **Step 7: `adapter.ts`をバレルファイルに置き換える**

`packages/app/src/lib/aco-wasm/adapter.ts`の内容を全て、以下に置き換える:

```typescript
export type { Position } from "./wasm-types";
export { loadAdapter, loadAdapterFromBytes } from "./loader";
export type { SimulationInitConfig } from "./population";
export { initializeSimulation, reinitializeAnts, addFood, addRandomFoods, resetAll } from "./population";
export type { RenderView } from "./render";
export { getRenderView } from "./render";
export type { StepConfig } from "./step";
export { stepSimulation, decaySimulation } from "./step";
```

- [ ] **Step 8: 4コマンドで確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
```

期待結果: `mise run test`(vitest)・`mise run test:bun`は現状のまま全件パス(24/24、両ランナーとも)。`build`は成功。`lint`は`useSimulation.ts`の既知の警告1件のみでexit 1(Task 4より前なので、この時点ではまだ想定内)。**6ファイルへの分割で振る舞いが一切変わっていないことを、既存の`adapter.test.ts`(`./adapter`からimportし続けている)が引き続き全件パスすることで確認する。**

- [ ] **Step 9: コミット**

```bash
git add packages/app/src/lib/aco-wasm/
git commit -m "refactor: adapter.tsを責務別に5ファイルへ分割(振る舞い凍結、公開APIはバレルで維持)"
```

---

### Task 2: instantiateStreamingのフォールバック追加 + nestオブジェクトの参照共有解消

**Files:**
- Modify: `packages/app/src/lib/aco-wasm/loader.ts`
- Modify: `packages/app/src/lib/aco-wasm/population.ts`

**Interfaces:**
- Consumes: Task 1で分割された`loader.ts`/`population.ts`
- Produces: なし(公開APIのシグネチャは変わらない)

- [ ] **Step 1: `instantiateStreamingFrom`にフォールバックを追加する**

`packages/app/src/lib/aco-wasm/loader.ts`の`instantiateStreamingFrom`を以下に置き換える:

```typescript
const instantiateStreamingFrom = async (response: Response): Promise<WasmExports> => {
  // 一部の静的ホスティングは.wasmを正しいMIMEタイプ(application/wasm)で配信せず、
  // instantiateStreamingが失敗することがある。streamingを試みる前にレスポンスを
  // clone()しておき、失敗時はボディ全体を読み込んでからinstantiateにフォールバックする
  // (streaming実行後はレスポンスボディが既に消費されている可能性があるため、
  // フォールバック用のcloneは必ずstreamingを試みる前に取得する)。
  const fallbackResponse = response.clone();
  try {
    const { instance } = await WebAssembly.instantiateStreaming(response, {});
    return instance.exports as unknown as WasmExports;
  } catch {
    const bytes = await fallbackResponse.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return instance.exports as unknown as WasmExports;
  }
};
```

- [ ] **Step 2: `nest`オブジェクトの参照共有を解消する**

`packages/app/src/lib/aco-wasm/population.ts`の`initializeSimulation`内、以下の行:

```typescript
  s.nest = config.nest;
```

を以下に置き換える(呼び出し元が保持する`config.nest`オブジェクトとアダプタ内部状態が同一参照を共有しないようにする):

```typescript
  s.nest = { ...config.nest };
```

- [ ] **Step 3: `loader.ts`に手動でのフォールバック確認テストを追加する(既存テストへの追記)**

`packages/app/src/lib/aco-wasm/adapter.test.ts`を開き、既存のテストの末尾(`describe`ブロックの最後の`it`の後)に以下のテストを追加する:

```typescript
  it("instantiateStreamingが失敗してもinstantiateにフォールバックしてロードできる", async () => {
    const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
    // instantiateStreamingを常に失敗させ、フォールバック経路が使われることを確認する
    WebAssembly.instantiateStreaming = (() =>
      Promise.reject(new Error("simulated streaming failure"))) as typeof WebAssembly.instantiateStreaming;

    try {
      const blob = new Blob([wasmBytes], { type: "application/wasm" });
      const response = new Response(blob);
      const { loadAdapter } = await import("./loader");
      await expect(
        loadAdapter(new URL("http://localhost/dummy.wasm")).catch(async () => {
          // loadAdapterは内部でfetchするため、テスト環境ではfetchが使えない可能性がある。
          // その場合はloader.tsの内部関数を直接検証する代わりに、
          // instantiateStreamingFromと同じロジックをここで検証する。
          throw new Error("skip");
        }),
      ).rejects.toThrow();
    } finally {
      WebAssembly.instantiateStreaming = originalInstantiateStreaming;
    }
  });
```

⚠️ **実装者への注記**: 上記のテスト案は`loadAdapter`が`fetch`に依存しておりテスト環境で動かしにくい可能性が高い。実装時は以下の方針に従うこと:
- `loader.ts`から`instantiateStreamingFrom`相当のロジックを直接テストできる形にする必要はない(内部関数のまま、公開APIとしてのテストに留める)。
- 現実的なテストとして、`loadAdapterFromBytes`は`instantiate`(非streaming)を使う経路であり、既に`adapter.test.ts`でカバーされている。`instantiateStreamingFrom`のフォールバック分岐自体は、`WebAssembly.instantiateStreaming`をモック化して`loadAdapter`が例外を投げずにロードを完了できることを確認するテストを1件追加すれば十分。`fetch`のモックが必要な場合は`globalThis.fetch`を一時的に差し替える(`vi.stubGlobal`または直接代入 + `finally`で復元)。
- テストが安定して書けない場合は、このStepをスキップしてテスト追加なしで進めて構わない(フォールバックの実装自体はStep 1で完了しており、既存のテストスイートを壊さないことを4コマンド確認で担保する)。この場合はレポートにその判断を明記すること。

- [ ] **Step 4: 4コマンドで確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
```

期待結果: 24件以上(Step 3でテストを追加した場合は25件)が両ランナーで一致、全件パス。`build`成功。`lint`はまだ既知の警告1件のみでexit 1(Task 4より前)。

- [ ] **Step 5: コミット**

```bash
git add packages/app/src/lib/aco-wasm/
git commit -m "fix: instantiateStreamingのフォールバックとnestオブジェクトの参照共有を解消"
```

---

### Task 3: SimulationCanvas.tsxのRAF早期return修正 + index.tsxのworld寸法重複解消

**Files:**
- Modify: `packages/app/src/components/ACOSimulation/SimulationCanvas.tsx`
- Modify: `packages/app/src/components/ACOSimulation/index.tsx`

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: `SimulationCanvas.tsx`のRAF早期returnを修正する**

`packages/app/src/components/ACOSimulation/SimulationCanvas.tsx`の`render`コールバック内、以下の行:

```typescript
    if (!canvas || !mainCtx) return;
```

を以下に置き換える(canvas/contextが一時的に取得できない場合でも、ループを止めずに次フレームで再試行する):

```typescript
    if (!canvas || !mainCtx) {
      animationFrameRef.current = requestAnimationFrame(render);
      return;
    }
```

- [ ] **Step 2: `index.tsx`のworld寸法ハードコードを解消する**

`packages/app/src/components/ACOSimulation/index.tsx`の`ACOSimulationReady`コンポーネントを以下に置き換える:

```typescript
const ACOSimulationReady = () => {
  useSimulation();
  const { worldWidth, worldHeight } = useSimulationStore();

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-gray-100">
      <div className="flex-1 flex items-center justify-center">
        <SimulationCanvas width={worldWidth} height={worldHeight} />
      </div>
      <div className="w-full lg:w-96">
        <ControlPanel />
      </div>
    </div>
  );
};
```

(ストアのデフォルト値`worldWidth: 800`/`worldHeight: 600`は変わらないため、見た目上の挙動は変化しない。)

- [ ] **Step 3: 4コマンドで確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
```

期待結果: 全件パス、両ランナー一致。`build`成功。`lint`はまだ既知の警告1件のみでexit 1(Task 4より前)。

- [ ] **Step 4: コミット**

```bash
git add packages/app/src/components/ACOSimulation/
git commit -m "fix: RAFループの早期returnとworld寸法のハードコードを解消"
```

---

### Task 4: useSimulation.tsのeffect依存配列警告を適切に解消する

**Files:**
- Modify: `packages/app/src/hooks/useSimulation.ts`

**Interfaces:**
- Consumes: なし
- Produces: なし

現状、`useEffect`の依存配列が`[simulationState.isRunning, simulationState.speed]`で、内部で参照している`animate`関数が依存配列に含まれていない(`react-hooks/exhaustive-deps`警告)。これまでのPlanでは「既知・対応不要」としてきたが、この計画では正しく解消する。

**方針**: `animate`関数の定義自体を`useEffect`の内側に移し、`isRunning`/`speed`を含む最新の状態は`useRef`経由で読むことで、`useEffect`の依存配列を空(`[]`)にする。これによりRAFループはマウント時に1回だけ開始され、以降は毎フレーム`ref`から最新の状態を読むため、`isRunning`/`speed`が変化してもRAFループを再起動(cancel + reschedule)する必要がなくなる(現状の実装は`isRunning`/`speed`が変わるたびにeffectが再実行され、RAFループが一度キャンセルされて再スケジュールされていた — 新しい実装ではこの再起動が起きなくなる点が唯一の挙動差だが、ユーザーから見た振る舞い(開始/停止/速度変更が次フレームで反映される)は変わらない)。

- [ ] **Step 1: `useSimulation.ts`を以下に置き換える**

```typescript
import { useEffect, useRef } from "react";
import { useSimulationStore } from "../stores/simulation.store";
import { stepSimulation, decaySimulation } from "../lib/aco-wasm/adapter";

const FRAME_DELAY_MS = 50;
const PHEROMONE_DECAY_INTERVAL_MS = 500;

export const useSimulation = () => {
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastDecayTimeRef = useRef<number>(0);

  const simulationState = useSimulationStore();
  // RAFループ(useEffect内)は毎フレーム実行されるが、simulationStateの変化のたびに
  // effectを再実行してループを再起動したくない(cancel + reschedule のオーバーヘッドと、
  // それに伴うreact-hooks/exhaustive-deps警告を避けるため)。そこでrefに最新値を
  // 保持し、ループ内では常にref経由で最新のisRunning/speedを読む。
  const simulationStateRef = useRef(simulationState);
  simulationStateRef.current = simulationState;

  useEffect(() => {
    const performSimulationStep = (currentTime: number) => {
      const { pheromoneDepositAmount, pheromoneTrackingStrength, pheromoneDecayRate } =
        useSimulationStore.getState();

      stepSimulation({ pheromoneDepositAmount, pheromoneTrackingStrength });

      if (currentTime - lastDecayTimeRef.current > PHEROMONE_DECAY_INTERVAL_MS) {
        decaySimulation(pheromoneDecayRate);
        lastDecayTimeRef.current = currentTime;
      }
    };

    const animate = (currentTime: number) => {
      const state = simulationStateRef.current;

      if (!state.isRunning) {
        lastTimeRef.current = currentTime;
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = currentTime - lastTimeRef.current;

      if (deltaTime > FRAME_DELAY_MS / state.speed) {
        performSimulationStep(currentTime);
        lastTimeRef.current = currentTime;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
};
```

- [ ] **Step 2: 4コマンドで確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
```

期待結果: `mise run test`・`mise run test:bun`は24/24、両ランナー一致。`build`成功。**`mise run lint`は今度こそexit 0になることを確認する**(`useSimulation.ts`の警告が解消されるため)。exit 0にならない場合、`react-hooks/exhaustive-deps`が指摘する他の変数がないか確認し、必要なら`simulationStateRef`/`performSimulationStep`/`animate`の依存関係を見直す。

- [ ] **Step 3: コミット**

```bash
git add packages/app/src/hooks/useSimulation.ts
git commit -m "fix: useSimulation.tsのexhaustive-deps警告をref方式への再構成で解消"
```

---

### Task 5: 最終確認

**Files:**
- なし(検証のみ)

**Interfaces:**
- Consumes: Task 1〜4の完了
- Produces: なし

- [ ] **Step 1: 4コマンドで最終確認する**

```bash
mise run test
mise run test:bun
mise run build
mise run lint
```

期待結果: `test`・`test:bun`は24/24、両ランナー一致。`build`成功。**`lint`はexit 0(警告なし)** — このPlanの完了によって、これまで4つのPlanを通じて「既知・対応不要」として持ち越されてきた唯一のlint警告が解消される。

- [ ] **Step 2: ブラウザでの起動確認**

```bash
mise run dev
```

`http://localhost:5173/`(または表示されたポート)を開き、以下を目視確認する:
- 読み込み→描画→開始が正常に動作する
- キャンバスをクリックして食料を追加できる
- フェロモンの軌跡が形成される
- リセットが動作する
- アリ数スライダーを動かしても正常に動作する(Task 3のworld寸法修正がキャンバスサイズに影響しないこと)

確認後、開発サーバーを停止する。

- [ ] **Step 3: これがPlan 2全体の完了条件**

4コマンド全てが期待結果通りであり、ブラウザでの目視確認が完了していれば、Plan 2は完了。
