# Plan B: JS側統合(adapter実装 + React配線) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan Aで実装した`moonbit/aco_core/`のWASMモジュールをReactアプリに実際に配線する。`src/lib/aco-wasm/adapter.ts`を新設し、`useSimulation.ts`が毎フレーム`adapter.step()`を呼び、`SimulationCanvas.tsx`が`adapter.getRenderView()`からゼロコピーで描画データを読む状態にする。完了条件は「`mise run dev`でブラウザからシミュレーションが実際にWASM経由で動作すること」。

**Architecture:** `adapter.ts`はモジュールレベルのシングルトンとして、WASM線形メモリ上のアリ/食料/フェロモングリッドへの生ポインタ(数値)のみを保持する。TypedArrayビューはポインタから毎回その場で構築し、決して`AdapterState`にキャッシュしない(WASM側の`alloc_*`呼び出しやメモリ成長は`memory.buffer`をdetachしうるため)。Zustandストア(`simulation.store.ts`)は「設定値」(`isRunning`/`speed`/`antCount`等)のみを保持する薄い層になり、構造変化を伴うアクション(`initializeSimulation`/`setAntCount`/`addFood`/`addRandomFoods`/`reset`)はadapterに委譲する。アリ・食料に個別の文字列IDは不要(外部から個体を参照するコードが無いことをgrepで確認済み)なため、adapter内部はindexのみで完結する。

**Tech Stack:** TypeScript, WebAssembly(`instantiateStreaming`/`instantiate`), Vite(静的アセットとしての`.wasm`読み込み), Zustand, Vitest。

## Global Constraints

- WASM線形メモリ上のTypedArrayビューは**関数呼び出しをまたいでキャッシュしない**。`adapter.ts`内の全ての読み書きは、そのつど`new Float64Array(wasm.memory.buffer, ptr, len)`のように現在の`memory.buffer`から構築する(`alloc_*`呼び出しや`step()`/`decay()`呼び出しがメモリを成長させ、既存のArrayBufferをdetachしうるため)
- WASM側に配列の解放API(`free`)は無い(Plan Aで意図的に許容した既知のトレードオフ)。構造変化(アリ数変更・食料追加)のたびに新しい配列を確保し、古いポインタは参照を手放す(小さなリークを許容する。低頻度操作のため実用上問題ない)
- 食料の枯渇(`amount <= 0`)はWASM側に削除機能が無いため、`step()`呼び出し後に**JS側で配列をin-place圧縮**する(新たなWASM確保は不要。生存要素を前方に詰め、`foodCount`を縮める)
- アリ・食料に文字列IDは持たせない(既存コードのどこからも個体をIDで参照していないことを確認済み)。全てindexベースで扱う
- `step()`の引数順は`moonbit/aco_core/step.mbt`の定義と完全に一致させる(22引数、`rng, ant_x, ant_y, ant_direction, ant_has_food, ant_target_food_index, ant_food_amount, ant_count, food_x, food_y, food_amount, food_count, pheromone_to_food, pheromone_to_nest, grid_width, grid_height, nest_x, nest_y, world_width, world_height, pheromone_deposit_amount, pheromone_tracking_strength`の順)
- フェロモングリッドのセルサイズは10固定。`grid_width = Math.floor(worldWidth / 10)`、`grid_height = Math.floor(worldHeight / 10)`とし、`grid_width * 10 === worldWidth`となる組み合わせを使う(Plan A最終レビューでparkされた`torus_distance`の潜在的な不整合を回避するため)
- テストは可能な限り実際にビルドされた`src/wasm/aco_core.wasm`を使う(モックしない)。`node:fs`の`readFileSync`でバイト列を読み、`WebAssembly.instantiate(bytes, {})`でインスタンス化する(Vitestはこの経路をサポートしている)

---

### Task 1: `moon build --target wasm --release`のビルドタスク追加 + 成果物のコミット

**Files:**
- Modify: `mise.toml`
- Create: `src/wasm/aco_core.wasm`(ビルド成果物、コミットする)

**Interfaces:**
- Consumes: `moonbit/aco_core/`(Plan Aで実装済み)
- Produces: `src/wasm/aco_core.wasm`。以降の全タスクがこのファイルを直接参照する

- [ ] **Step 1: `mise.toml`に`build:wasm`タスクを追加する**

```toml
[tasks."build:wasm"]
description = "MoonBitコアをwasmでビルドしsrc/wasm/にコピー"
run = """
cd moonbit/aco_core && moon build --target wasm --release
cp _build/wasm/release/build/aco_core.wasm ../../src/wasm/aco_core.wasm
"""
```

- [ ] **Step 2: タスクを実行し、成果物のパスを確認する**

```bash
mkdir -p src/wasm
mise run build:wasm
```

Expected: `src/wasm/aco_core.wasm`が生成される。もし`cp`のソースパス(`_build/wasm/release/build/aco_core.wasm`)がエラーになる場合は、`find moonbit/aco_core/_build -name "*.wasm"`で実際の出力パスを確認し、`mise.toml`の`cp`行を実際のパスに修正すること(debugビルドは`_build/wasm/debug/build/`だったが、`--release`では異なる可能性がある)

- [ ] **Step 3: 生成された`.wasm`が正しく動作することを、既存のスモークテストで確認する**

```bash
node moonbit/aco_core/scripts/ffi-smoke-test.mjs
```

Expected: 10/10 PASS(このスクリプトはdebugビルドの成果物を参照しているため、`.wasm`自体の正しさを再確認する目的。パスが違うのでこの時点でreleaseビルドとは別物だが、両方が存在してPASSすることを確認する)

- [ ] **Step 4: `.gitignore`を確認し、`src/wasm/aco_core.wasm`が誤って除外されていないことを確認する**

```bash
git check-ignore -v src/wasm/aco_core.wasm || echo "OK: 除外されていない"
```

Expected: "OK: 除外されていない"

- [ ] **Step 5: コミット**

```bash
git add mise.toml src/wasm/aco_core.wasm
git commit -m "build: MoonBitコアのwasmビルドタスクを追加し成果物をコミット"
```

---

### Task 2: `adapter.ts` — ロードと読み取り系(initRuntime / getRenderView)

**Files:**
- Create: `src/lib/aco-wasm/adapter.ts`
- Create: `src/lib/aco-wasm/adapter.test.ts`

**Interfaces:**
- Consumes: `src/wasm/aco_core.wasm`、`Position`型(`@/lib/aco/types`)
- Produces: `loadAdapter(wasmUrl: URL): Promise<void>`、`loadAdapterFromBytes(bytes: ArrayBuffer): Promise<void>`(テスト用)、`initializeSimulation(config): void`、`getRenderView(): RenderView`型。Task 3以降がこれらの型・関数を使う

- [ ] **Step 1: 失敗するテストを先に書く**

```typescript
// src/lib/aco-wasm/adapter.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAdapterFromBytes, initializeSimulation, getRenderView } from "./adapter";

const wasmBytes = readFileSync(resolve(import.meta.dirname, "../../wasm/aco_core.wasm"));

beforeEach(async () => {
  await loadAdapterFromBytes(wasmBytes.buffer.slice(wasmBytes.byteOffset, wasmBytes.byteOffset + wasmBytes.byteLength));
});

describe("initializeSimulation", () => {
  it("creates the requested number of ants at the nest position", () => {
    initializeSimulation({ antCount: 5, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });

    const view = getRenderView();
    expect(view.antCount).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(view.antX[i]).toBe(400);
      expect(view.antY[i]).toBe(300);
      expect(view.antHasFood[i]).toBe(0);
    }
  });

  it("initializes an empty pheromone grid sized for the world", () => {
    initializeSimulation({ antCount: 1, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });

    const view = getRenderView();
    expect(view.gridWidth).toBe(80);
    expect(view.gridHeight).toBe(60);
    expect(view.pheromoneToFood.length).toBe(80 * 60);
    expect(view.pheromoneToFood.every((v) => v === 0)).toBe(true);
    expect(view.pheromoneToNest.every((v) => v === 0)).toBe(true);
  });

  it("starts with zero food", () => {
    initializeSimulation({ antCount: 1, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });

    expect(getRenderView().foodCount).toBe(0);
  });
});

describe("getRenderView", () => {
  it("returns fresh views each call (not the same array instance)", () => {
    initializeSimulation({ antCount: 1, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });

    const first = getRenderView();
    const second = getRenderView();
    expect(first.antX).not.toBe(second.antX);
    expect(first.antX[0]).toBe(second.antX[0]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `bun run test -- adapter.test.ts`
Expected: コンパイルエラー(`adapter.ts`が存在しない)

- [ ] **Step 3: 実装を書く**

```typescript
// src/lib/aco-wasm/adapter.ts
import type { Position } from "@/lib/aco/types";

const CELL_SIZE = 10;

type WasmExports = {
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

type AntPointers = {
  x: number;
  y: number;
  direction: number;
  hasFood: number;
  targetFoodIndex: number;
  foodAmount: number;
};

type FoodPointers = {
  x: number;
  y: number;
  amount: number;
};

type PheromonePointers = {
  toFood: number;
  toNest: number;
};

type AdapterState = {
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

let state: AdapterState | null = null;

const getState = (): AdapterState => {
  if (!state) {
    throw new Error("adapter is not initialized: call loadAdapter() first");
  }
  return state;
};

const f64 = (ptr: number, len: number): Float64Array =>
  new Float64Array(getState().wasm.memory.buffer, ptr, len);

const i32 = (ptr: number, len: number): Int32Array =>
  new Int32Array(getState().wasm.memory.buffer, ptr, len);

const u8 = (ptr: number, len: number): Uint8Array =>
  new Uint8Array(getState().wasm.memory.buffer, ptr, len);

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
  const wasm = await instantiateStreamingFrom(fetch(wasmUrl));
  state = createEmptyState(wasm);
};

/** テスト用: 既に読み込んだバイト列からロードする。 */
export const loadAdapterFromBytes = async (bytes: ArrayBuffer): Promise<void> => {
  const wasm = await instantiate(bytes);
  state = createEmptyState(wasm);
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

- [ ] **Step 4: テストを実行してPASSすることを確認する**

Run: `bun run test -- adapter.test.ts`
Expected: 全ケースPASS。`alloc_f64(0)`(食料ゼロ件の確保)がエラーになる場合は、コンパイルエラーではなく実行時エラーになりうるので、`moon`側の挙動を確認しつつ`Math.max(1, count)`で最低1要素確保するなどの回避を検討すること

- [ ] **Step 5: コミット**

```bash
git add src/lib/aco-wasm/adapter.ts src/lib/aco-wasm/adapter.test.ts
git commit -m "feat(adapter): WASMロードとinitializeSimulation/getRenderViewを実装"
```

---

### Task 3: `adapter.ts` — 構造変化系(reinitializeAnts / addFood / addRandomFoods / resetAll)

**Files:**
- Modify: `src/lib/aco-wasm/adapter.ts`
- Modify: `src/lib/aco-wasm/adapter.test.ts`

**Interfaces:**
- Consumes: Task 2の`AdapterState`、`f64`/`i32`/`u8`ヘルパー
- Produces: `reinitializeAnts(antCount: number): void`、`addFood(position: Position, amount?: number): void`、`addRandomFoods(count: number): void`、`resetAll(config: SimulationInitConfig): void`。Task 5(store)がこれらを呼ぶ

- [ ] **Step 1: 失敗するテストを先に書く**

```typescript
// src/lib/aco-wasm/adapter.test.ts に追加
import { reinitializeAnts, addFood, addRandomFoods, resetAll } from "./adapter";

describe("reinitializeAnts", () => {
  it("replaces ants and clears pheromones, but preserves existing food", () => {
    initializeSimulation({ antCount: 3, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });
    addFood({ x: 100, y: 100 });

    reinitializeAnts(7);

    const view = getRenderView();
    expect(view.antCount).toBe(7);
    expect(view.foodCount).toBe(1);
    expect(view.foodX[0]).toBe(100);
  });
});

describe("addFood", () => {
  it("appends a food entry preserving previously added ones", () => {
    initializeSimulation({ antCount: 1, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });

    addFood({ x: 10, y: 20 });
    addFood({ x: 30, y: 40 });

    const view = getRenderView();
    expect(view.foodCount).toBe(2);
    expect(Array.from(view.foodX)).toEqual([10, 30]);
    expect(Array.from(view.foodY)).toEqual([20, 40]);
    expect(view.foodAmount[0]).toBe(100);
  });
});

describe("addRandomFoods", () => {
  it("adds the requested number of foods within world bounds", () => {
    initializeSimulation({ antCount: 1, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });

    addRandomFoods(5);

    const view = getRenderView();
    expect(view.foodCount).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(view.foodX[i]).toBeGreaterThanOrEqual(0);
      expect(view.foodX[i]).toBeLessThanOrEqual(800);
      expect(view.foodAmount[i]).toBeGreaterThanOrEqual(50);
      expect(view.foodAmount[i]).toBeLessThanOrEqual(150);
    }
  });
});

describe("resetAll", () => {
  it("clears food and reinitializes ants/pheromones", () => {
    initializeSimulation({ antCount: 3, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });
    addFood({ x: 10, y: 20 });

    resetAll({ antCount: 9, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });

    const view = getRenderView();
    expect(view.antCount).toBe(9);
    expect(view.foodCount).toBe(0);
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `bun run test -- adapter.test.ts`
Expected: コンパイルエラー

- [ ] **Step 3: 実装を書く(`adapter.ts`に追記)**

`initializeSimulation`をそのまま呼ぶと食料も`foodCount: 0`にリセットされてしまう。TS版の元の`initializeSimulation`アクションは`foods`に触れない仕様(`set({ ants: newAnts, pheromones: new Map() })`)なので、`reinitializeAnts`はアリとフェロモングリッドだけを再確保し、食料の状態(`s.food`/`s.foodCount`)には触れない別実装にする:

```typescript
/** アリだけを再生成し、フェロモングリッドをクリアする。食料は変更しない。 */
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
  const pheromoneToFoodPtr = wasm.alloc_f64(gridCells);
  const pheromoneToNestPtr = wasm.alloc_f64(gridCells);

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

  s.antCount = antCount;
  s.ant = {
    x: antXPtr,
    y: antYPtr,
    direction: antDirPtr,
    hasFood: antHasFoodPtr,
    targetFoodIndex: antTargetPtr,
    foodAmount: antFoodAmountPtr,
  };
  s.pheromone = { toFood: pheromoneToFoodPtr, toNest: pheromoneToNestPtr };
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

- [ ] **Step 4: テストを実行してPASSすることを確認する**

Run: `bun run test -- adapter.test.ts`
Expected: 全ケースPASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/aco-wasm/adapter.ts src/lib/aco-wasm/adapter.test.ts
git commit -m "feat(adapter): reinitializeAnts/addFood/addRandomFoods/resetAllを実装"
```

---

### Task 4: `adapter.ts` — step / decay + 食料コンパクション

**Files:**
- Modify: `src/lib/aco-wasm/adapter.ts`
- Modify: `src/lib/aco-wasm/adapter.test.ts`

**Interfaces:**
- Consumes: Task 2/3の`AdapterState`
- Produces: `stepSimulation(config: { pheromoneDepositAmount: number; pheromoneTrackingStrength: number }): void`、`decaySimulation(decayRate: number): void`。Task 6(`useSimulation.ts`)がこれらを呼ぶ

- [ ] **Step 1: 失敗するテストを先に書く**

```typescript
// src/lib/aco-wasm/adapter.test.ts に追加
import { stepSimulation, decaySimulation } from "./adapter";

describe("stepSimulation", () => {
  it("moves ants without throwing", () => {
    initializeSimulation({ antCount: 3, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });

    expect(() =>
      stepSimulation({ pheromoneDepositAmount: 2, pheromoneTrackingStrength: 0.7 }),
    ).not.toThrow();

    const view = getRenderView();
    const moved = Array.from({ length: 3 }, (_, i) => view.antX[i] !== 400 || view.antY[i] !== 300);
    expect(moved.some(Boolean)).toBe(true);
  });

  it("compacts depleted food out of the array after step", () => {
    initializeSimulation({ antCount: 1, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });
    // アリのすぐ隣(巣から離れた場所)に量1の食料を置き、確実に1ステップで
    // 収集・枯渇させる。アリは巣位置(400,300)からスタートするため、
    // 食料検出範囲(20)内に置く。
    addFood({ x: 405, y: 300 }, 1);

    expect(getRenderView().foodCount).toBe(1);

    // 収集は距離<10の場合のみ即時なので、必要なら数フレーム回す。
    for (let i = 0; i < 20 && getRenderView().foodCount > 0; i++) {
      stepSimulation({ pheromoneDepositAmount: 2, pheromoneTrackingStrength: 0.7 });
    }

    expect(getRenderView().foodCount).toBe(0);
  });
});

describe("decaySimulation", () => {
  it("reduces existing pheromone intensity", () => {
    initializeSimulation({ antCount: 1, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });
    // フェロモングリッドに直接値を書き込む(テスト専用の内部アクセス)。
    const view = getRenderView();
    view.pheromoneToFood[42] = 50;

    decaySimulation(0.9);

    expect(getRenderView().pheromoneToFood[42]).toBeLessThan(50);
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `bun run test -- adapter.test.ts`
Expected: コンパイルエラー

- [ ] **Step 3: 実装を書く(`adapter.ts`に追記)**

```typescript
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

- [ ] **Step 4: テストを実行してPASSすることを確認する**

Run: `bun run test -- adapter.test.ts`
Expected: 全ケースPASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/aco-wasm/adapter.ts src/lib/aco-wasm/adapter.test.ts
git commit -m "feat(adapter): stepSimulation/decaySimulationと食料コンパクションを実装"
```

---

### Task 5: `simulation.store.ts` の再構成(アリ・食料・フェロモンをadapterに委譲)

**Files:**
- Modify: `src/stores/simulation.store.ts`
- Modify: `src/stores/simulation.store.test.ts`

**Interfaces:**
- Consumes: Task 2-4の`adapter.ts`(`initializeSimulation`/`reinitializeAnts`/`addFood`/`addRandomFoods`/`resetAll`)
- Produces: 変更後の`useSimulationStore`(`ants`/`foods`/`pheromones`/`updateAnt`/`updatePheromone`/`updateFood`/`removeFood`フィールドを削除)。Task 6/7/8がこの新しいストア形状を前提にする

このタスクではストアのテストを`vi.mock`でadapterをモックして書く(ストアの責務は「正しいadapter関数を正しい引数で呼ぶこと」であり、WASMの実際の計算はTask 2-4で既にテスト済みのため)。

- [ ] **Step 1: 失敗するテストを先に書く(既存テストを全面的に書き換える)**

```typescript
// src/stores/simulation.store.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("@/lib/aco-wasm/adapter", () => ({
  initializeSimulation: vi.fn(),
  reinitializeAnts: vi.fn(),
  addFood: vi.fn(),
  addRandomFoods: vi.fn(),
  resetAll: vi.fn(),
}));

import * as adapter from "@/lib/aco-wasm/adapter";
import { useSimulationStore } from "./simulation.store";

describe("useSimulationStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSimulationStore.setState({
      nest: { x: 400, y: 300 },
      isRunning: false,
      speed: 1,
      antCount: 50,
      pheromoneDecayRate: 0.99,
      pheromoneDepositAmount: 2,
      pheromoneTrackingStrength: 0.7,
      worldWidth: 800,
      worldHeight: 600,
    });
  });

  describe("initializeSimulation", () => {
    it("delegates to adapter.initializeSimulation with current settings", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.initializeSimulation();
      });

      expect(adapter.initializeSimulation).toHaveBeenCalledWith({
        antCount: 50,
        nest: { x: 400, y: 300 },
        worldWidth: 800,
        worldHeight: 600,
      });
    });
  });

  describe("toggleSimulation", () => {
    it("toggles isRunning state", () => {
      const { result } = renderHook(() => useSimulationStore());

      expect(result.current.isRunning).toBe(false);
      act(() => {
        result.current.toggleSimulation();
      });
      expect(result.current.isRunning).toBe(true);
    });
  });

  describe("setSpeed", () => {
    it("updates speed", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.setSpeed(2.5);
      });

      expect(result.current.speed).toBe(2.5);
    });
  });

  describe("setAntCount", () => {
    it("updates antCount and delegates to adapter.reinitializeAnts", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.setAntCount(25);
      });

      expect(result.current.antCount).toBe(25);
      expect(adapter.reinitializeAnts).toHaveBeenCalledWith(25);
    });
  });

  describe("food management", () => {
    it("delegates addFood to the adapter", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.addFood({ x: 100, y: 200 });
      });

      expect(adapter.addFood).toHaveBeenCalledWith({ x: 100, y: 200 });
    });

    it("delegates addRandomFoods to the adapter", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.addRandomFoods(5);
      });

      expect(adapter.addRandomFoods).toHaveBeenCalledWith(5);
    });
  });

  describe("reset", () => {
    it("stops the simulation and delegates to adapter.resetAll", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.toggleSimulation();
      });
      expect(result.current.isRunning).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.isRunning).toBe(false);
      expect(adapter.resetAll).toHaveBeenCalledWith({
        antCount: 50,
        nest: { x: 400, y: 300 },
        worldWidth: 800,
        worldHeight: 600,
      });
    });
  });

  describe("pheromone parameters", () => {
    it("updates pheromone decay rate", () => {
      const { result } = renderHook(() => useSimulationStore());
      act(() => {
        result.current.setPheromoneDecayRate(0.95);
      });
      expect(result.current.pheromoneDecayRate).toBe(0.95);
    });

    it("updates pheromone deposit amount", () => {
      const { result } = renderHook(() => useSimulationStore());
      act(() => {
        result.current.setPheromoneDepositAmount(5);
      });
      expect(result.current.pheromoneDepositAmount).toBe(5);
    });

    it("updates pheromone tracking strength", () => {
      const { result } = renderHook(() => useSimulationStore());
      act(() => {
        result.current.setPheromoneTrackingStrength(0.9);
      });
      expect(result.current.pheromoneTrackingStrength).toBe(0.9);
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `bun run test -- simulation.store.test.ts`
Expected: 失敗(現行実装は`adapter`を呼ばず、`ants`/`foods`/`pheromones`フィールドも残っている)

- [ ] **Step 3: 実装を書き換える**

```typescript
// src/stores/simulation.store.ts
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

type SimulationState = {
  nest: Position;
  isRunning: boolean;
  speed: number;
  antCount: number;
  pheromoneDecayRate: number;
  pheromoneDepositAmount: number;
  pheromoneTrackingStrength: number;
  worldWidth: number;
  worldHeight: number;
};

type SimulationActions = {
  initializeSimulation: () => void;
  toggleSimulation: () => void;
  setSpeed: (speed: number) => void;
  setAntCount: (count: number) => void;
  setPheromoneDecayRate: (rate: number) => void;
  setPheromoneDepositAmount: (amount: number) => void;
  setPheromoneTrackingStrength: (strength: number) => void;
  addFood: (position: Position) => void;
  addRandomFoods: (count: number) => void;
  reset: () => void;
};

export const useSimulationStore = create<SimulationState & SimulationActions>()(
  devtools(
    (set, get) => ({
      nest: { x: 400, y: 300 },
      isRunning: false,
      speed: 1,
      antCount: 50,
      pheromoneDecayRate: 0.99,
      pheromoneDepositAmount: 2,
      pheromoneTrackingStrength: 0.7,
      worldWidth: 800,
      worldHeight: 600,

      initializeSimulation: () => {
        const { antCount, nest, worldWidth, worldHeight } = get();
        adapterInitializeSimulation({ antCount, nest, worldWidth, worldHeight });
      },

      toggleSimulation: () => {
        set((state) => ({ isRunning: !state.isRunning }));
      },

      setSpeed: (speed) => {
        set({ speed });
      },

      setAntCount: (count) => {
        set({ antCount: count });
        reinitializeAnts(count);
      },

      setPheromoneDecayRate: (rate) => {
        set({ pheromoneDecayRate: rate });
      },

      setPheromoneDepositAmount: (amount) => {
        set({ pheromoneDepositAmount: amount });
      },

      setPheromoneTrackingStrength: (strength) => {
        set({ pheromoneTrackingStrength: strength });
      },

      addFood: (position) => {
        adapterAddFood(position);
      },

      addRandomFoods: (count) => {
        adapterAddRandomFoods(count);
      },

      reset: () => {
        const { antCount, nest, worldWidth, worldHeight } = get();
        set({ isRunning: false });
        resetAll({ antCount, nest, worldWidth, worldHeight });
      },
    }),
    {
      name: "aco-simulation",
    },
  ),
);
```

- [ ] **Step 4: テストを実行してPASSすることを確認する**

Run: `bun run test -- simulation.store.test.ts`
Expected: 全ケースPASS

- [ ] **Step 5: コミット**

```bash
git add src/stores/simulation.store.ts src/stores/simulation.store.test.ts
git commit -m "refactor(store): ants/foods/pheromonesを削除しadapterに委譲する"
```

---

### Task 6: `useSimulation.ts` をadapter経由に置き換える

**Files:**
- Modify: `src/hooks/useSimulation.ts`
- Modify: `src/hooks/useSimulation.test.ts`

**Interfaces:**
- Consumes: Task 4の`stepSimulation`/`decaySimulation`
- Produces: `useSimulation(): void`(公開シグネチャ不変)

- [ ] **Step 1: 実装を書き換える(TDDだが、この規模の統合フックは既存のスモークテストパターンを踏襲する)**

```typescript
// src/hooks/useSimulation.ts
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

  const animate = (currentTime: number) => {
    if (!simulationState.isRunning) {
      lastTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const deltaTime = currentTime - lastTimeRef.current;

    if (deltaTime > FRAME_DELAY_MS / simulationState.speed) {
      performSimulationStep(currentTime);
      lastTimeRef.current = currentTime;
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const performSimulationStep = (currentTime: number) => {
    const { pheromoneDepositAmount, pheromoneTrackingStrength, pheromoneDecayRate } =
      useSimulationStore.getState();

    stepSimulation({ pheromoneDepositAmount, pheromoneTrackingStrength });

    if (currentTime - lastDecayTimeRef.current > PHEROMONE_DECAY_INTERVAL_MS) {
      decaySimulation(pheromoneDecayRate);
      lastDecayTimeRef.current = currentTime;
    }
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [simulationState.isRunning, simulationState.speed]);
};
```

**注記**: 元の実装は`simulationState.ants/foods/pheromones`の変化を`useEffect`の依存配列に含めることで、状態更新のたびにアニメーションループを再起動していたが、これらのフィールドはTask 5でストアから削除されている。WASM側のアリ/食料/フェロモンはZustandの再レンダリングとは独立してWASM線形メモリ上で変化するため、この依存配列は`isRunning`/`speed`のみで正しい(ループ自体はrequestAnimationFrameで毎フレーム回り続け、フレームごとに直接`stepSimulation`を呼ぶため、Reactの再レンダリングに依存する必要が無くなった)。

- [ ] **Step 2: 既存のスモークテストを確認・調整する**

`src/hooks/useSimulation.test.ts`は`adapter`のWASM初期化が完了していない状態でも例外を投げないことを確認する必要がある。`getState()`が未初期化時に例外を投げる設計(Task 2)のため、テスト実行前に`loadAdapterFromBytes`でアダプタをロードしてから`renderHook`する:

```typescript
// src/hooks/useSimulation.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useSimulation } from "./useSimulation";
import { loadAdapterFromBytes, initializeSimulation } from "@/lib/aco-wasm/adapter";

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

beforeAll(async () => {
  const wasmBytes = readFileSync(resolve(import.meta.dirname, "../wasm/aco_core.wasm"));
  await loadAdapterFromBytes(
    wasmBytes.buffer.slice(wasmBytes.byteOffset, wasmBytes.byteOffset + wasmBytes.byteLength),
  );
  initializeSimulation({ antCount: 1, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });
});

describe("useSimulation", () => {
  it("should export useSimulation function", () => {
    expect(typeof useSimulation).toBe("function");
  });

  it("should not throw when rendered", () => {
    expect(() => renderHook(() => useSimulation())).not.toThrow();
  });
});
```

- [ ] **Step 3: テストを実行してPASSすることを確認する**

Run: `bun run test -- useSimulation.test.ts`
Expected: 2ケースともPASS

- [ ] **Step 4: コミット**

```bash
git add src/hooks/useSimulation.ts src/hooks/useSimulation.test.ts
git commit -m "refactor(useSimulation): adapter.stepSimulation/decaySimulation経由に置き換え"
```

---

### Task 7: `SimulationCanvas.tsx` をadapterのRenderView経由に置き換える

**Files:**
- Modify: `src/components/ACOSimulation/SimulationCanvas.tsx`

**Interfaces:**
- Consumes: Task 2の`getRenderView()`、Task 5後のストア(`nest`のみ読む)
- Produces: 変更後の`SimulationCanvas`コンポーネント(公開propsは不変)

このコンポーネントには自動テストが無い(既存もそうだった)ため、このタスクの検証は`mise run dev`での目視確認(Task 9)に委ねる。密グリッド化により`pheromoneGrid`の`useMemo`による独自空間インデックスは丸ごと不要になる。

- [ ] **Step 1: 実装を書き換える**

```typescript
// src/components/ACOSimulation/SimulationCanvas.tsx
import { useEffect, useRef, useCallback } from "react";
import { useSimulationStore } from "@/stores/simulation.store";
import { getRenderView } from "@/lib/aco-wasm/adapter";
import type { Position } from "@/lib/aco/types";

type SimulationCanvasProps = {
  width: number;
  height: number;
};

export const SimulationCanvas = ({ width, height }: SimulationCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null);
  const offscreenCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null);
  const pheromoneCanvasRef = useRef<OffscreenCanvas | null>(null);
  const pheromoneCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null);
  const staticCanvasRef = useRef<OffscreenCanvas | null>(null);
  const staticCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastPheromoneUpdateRef = useRef<number>(0);

  const { nest, addFood } = useSimulationStore();

  // オフスクリーンキャンバスの初期化（エラーハンドリング付き）
  useEffect(() => {
    try {
      if (typeof OffscreenCanvas !== "undefined") {
        offscreenCanvasRef.current = new OffscreenCanvas(width, height);
        const offscreenCtx = offscreenCanvasRef.current.getContext("2d");

        if (!offscreenCtx) {
          throw new Error("オフスクリーンキャンバスの2Dコンテキストを取得できませんでした");
        }
        offscreenCtxRef.current = offscreenCtx;

        pheromoneCanvasRef.current = new OffscreenCanvas(width, height);
        const pheromoneCtx = pheromoneCanvasRef.current.getContext("2d");

        if (!pheromoneCtx) {
          throw new Error("フェロモンキャンバスの2Dコンテキストを取得できませんでした");
        }
        pheromoneCtxRef.current = pheromoneCtx;

        staticCanvasRef.current = new OffscreenCanvas(width, height);
        const staticCtx = staticCanvasRef.current.getContext("2d");

        if (!staticCtx) {
          throw new Error("静的キャンバスの2Dコンテキストを取得できませんでした");
        }
        staticCtxRef.current = staticCtx;
      } else {
        console.warn("OffscreenCanvasがサポートされていません。フォールバック実装を使用します。");
      }
    } catch (error) {
      console.error("キャンバスの初期化中にエラーが発生しました:", error);
      offscreenCanvasRef.current = null;
      offscreenCtxRef.current = null;
      pheromoneCanvasRef.current = null;
      pheromoneCtxRef.current = null;
      staticCanvasRef.current = null;
      staticCtxRef.current = null;
    }
  }, [width, height]);

  const drawCircle = useCallback(
    (
      ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      position: Position,
      radius: number,
      color: string,
    ) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
      ctx.fill();
    },
    [],
  );

  const drawPheromoneGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      grid: Float64Array,
      gridWidth: number,
      cellSize: number,
      color: string,
      globalAlphaScale: number,
    ) => {
      for (let i = 0; i < grid.length; i++) {
        const raw = grid[i];
        if (raw <= 0) continue;
        const intensity = Math.min(raw / 100, 1);
        if (intensity < 0.05) continue;

        const gx = i % gridWidth;
        const gy = Math.floor(i / gridWidth);
        const cx = gx * cellSize + cellSize / 2;
        const cy = gy * cellSize + cellSize / 2;
        const radius = 12 + intensity * 15;

        ctx.globalAlpha = intensity * globalAlphaScale;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    [],
  );

  const drawPheromones = useCallback(
    (ctx: OffscreenCanvasRenderingContext2D, view: ReturnType<typeof getRenderView>) => {
      const now = performance.now();

      // フェロモン層は100msごとにのみ更新する
      if (now - lastPheromoneUpdateRef.current < 100) {
        return false;
      }
      lastPheromoneUpdateRef.current = now;

      ctx.clearRect(0, 0, width, height);
      drawPheromoneGrid(ctx, view.pheromoneToFood, view.gridWidth, view.cellSize, "#00ff00", 1);
      drawPheromoneGrid(ctx, view.pheromoneToNest, view.gridWidth, view.cellSize, "#0096ff", 1);

      return true;
    },
    [drawPheromoneGrid, width, height],
  );

  const drawFoods = useCallback(
    (
      ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      view: ReturnType<typeof getRenderView>,
    ) => {
      ctx.fillStyle = "#FFA500";
      for (let i = 0; i < view.foodCount; i++) {
        const size = Math.max(3, view.foodAmount[i] / 10);
        ctx.beginPath();
        ctx.arc(view.foodX[i], view.foodY[i], size, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [],
  );

  const drawAnts = useCallback(
    (
      ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      view: ReturnType<typeof getRenderView>,
    ) => {
      // hasFoodで色分けしつつ1パスで描画する
      for (let i = 0; i < view.antCount; i++) {
        ctx.fillStyle = view.antHasFood[i] === 1 ? "#FF6B6B" : "#FFFFFF";
        ctx.beginPath();
        ctx.arc(view.antX[i], view.antY[i], 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = "#CCCCCC";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < view.antCount; i++) {
        ctx.moveTo(view.antX[i], view.antY[i]);
        ctx.lineTo(
          view.antX[i] + Math.cos(view.antDirection[i]) * 8,
          view.antY[i] + Math.sin(view.antDirection[i]) * 8,
        );
      }
      ctx.stroke();
    },
    [],
  );

  const drawNest = useCallback(
    (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
      drawCircle(ctx, nest, 15, "#D2691E");
      ctx.strokeStyle = "#FF8C00";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(nest.x, nest.y, 15, 0, Math.PI * 2);
      ctx.stroke();
    },
    [nest, drawCircle],
  );

  const drawStatic = useCallback(() => {
    const ctx = staticCtxRef.current;
    if (!ctx) return;

    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, width, height);
    drawNest(ctx);
  }, [width, height, drawNest]);

  useEffect(() => {
    drawStatic();
  }, [drawStatic]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const mainCtx = canvas?.getContext("2d");
    const offscreenCtx = offscreenCtxRef.current;
    const pheromoneCtx = pheromoneCtxRef.current;
    const staticCtx = staticCtxRef.current;

    if (!canvas || !mainCtx) return;

    const view = getRenderView();

    if (offscreenCtx && pheromoneCtx && staticCtx) {
      offscreenCtx.clearRect(0, 0, width, height);
      offscreenCtx.drawImage(staticCanvasRef.current!, 0, 0);

      drawPheromones(pheromoneCtx, view);
      offscreenCtx.globalAlpha = 0.7;
      offscreenCtx.drawImage(pheromoneCanvasRef.current!, 0, 0);
      offscreenCtx.globalAlpha = 1;

      drawFoods(offscreenCtx, view);
      drawAnts(offscreenCtx, view);

      mainCtx.clearRect(0, 0, width, height);
      mainCtx.drawImage(offscreenCanvasRef.current!, 0, 0);
    } else {
      mainCtx.clearRect(0, 0, width, height);
      mainCtx.fillStyle = "#2a2a2a";
      mainCtx.fillRect(0, 0, width, height);

      drawPheromoneGrid(mainCtx, view.pheromoneToFood, view.gridWidth, view.cellSize, "#00ff00", 0.7);
      drawPheromoneGrid(mainCtx, view.pheromoneToNest, view.gridWidth, view.cellSize, "#0096ff", 0.7);

      drawNest(mainCtx);
      drawFoods(mainCtx, view);
      drawAnts(mainCtx, view);
    }

    animationFrameRef.current = requestAnimationFrame(render);
  }, [width, height, drawPheromones, drawPheromoneGrid, drawNest, drawFoods, drawAnts]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      addFood({ x, y });
    },
    [addFood],
  );

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-300 rounded-lg cursor-crosshair"
      onClick={handleClick}
    />
  );
};
```

- [ ] **Step 2: `bun run build`(型チェック含む)が通ることを確認する**

Run: `bun run build`
Expected: TypeScriptの型エラーが無いこと(このコンポーネントには実行テストが無いため、型チェックが最初の防御線になる)

- [ ] **Step 3: コミット**

```bash
git add src/components/ACOSimulation/SimulationCanvas.tsx
git commit -m "refactor(canvas): adapter.getRenderView()経由の描画に置き換え、pheromoneGrid空間インデックスを削除"
```

---

### Task 8: `ACOSimulation/index.tsx` — 非同期WASM初期化とローディング/エラー表示

**Files:**
- Modify: `src/components/ACOSimulation/index.tsx`

**Interfaces:**
- Consumes: Task 2の`loadAdapter`
- Produces: WASM初期化中はローディング表示、失敗時はエラー表示、成功後にシミュレーションを開始する`ACOSimulation`コンポーネント

- [ ] **Step 1: 実装を書き換える**

```typescript
// src/components/ACOSimulation/index.tsx
import { useEffect, useRef, useState } from "react";
import { useSimulationStore } from "@/stores/simulation.store";
import { loadAdapter } from "@/lib/aco-wasm/adapter";
import { SimulationCanvas } from "./SimulationCanvas";
import { ControlPanel } from "./ControlPanel";
import { useSimulation } from "@/hooks/useSimulation";

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

export const ACOSimulation = () => {
  const { initializeSimulation, addRandomFoods } = useSimulationStore();
  const isInitialized = useRef(false);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const wasmUrl = new URL("../../wasm/aco_core.wasm", import.meta.url);
    loadAdapter(wasmUrl)
      .then(() => {
        initializeSimulation();
        addRandomFoods(10);
        setLoadState({ status: "ready" });
      })
      .catch((error: unknown) => {
        console.error("WASMモジュールの初期化に失敗しました:", error);
        setLoadState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }, [initializeSimulation, addRandomFoods]);

  if (loadState.status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-600">シミュレーションエンジンを読み込み中...</p>
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-red-600">
          シミュレーションエンジンの読み込みに失敗しました: {loadState.message}
        </p>
      </div>
    );
  }

  return <ACOSimulationReady />;
};

const ACOSimulationReady = () => {
  useSimulation();

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-gray-100">
      <div className="flex-1 flex items-center justify-center">
        <SimulationCanvas width={800} height={600} />
      </div>
      <div className="w-full lg:w-96">
        <ControlPanel />
      </div>
    </div>
  );
};
```

**注記**: `useSimulation()`(毎フレーム`stepSimulation`を呼ぶ)はWASMロード完了後にのみ呼ばれるよう、`ACOSimulationReady`という別コンポーネントに分離した(ロード中に`useSimulation`が呼ばれてadapterの`getState()`が例外を投げるのを防ぐため)。

- [ ] **Step 2: `bun run build`が通ることを確認する**

Run: `bun run build`
Expected: 型エラー無し

- [ ] **Step 3: コミット**

```bash
git add src/components/ACOSimulation/index.tsx
git commit -m "feat(ACOSimulation): WASM非同期初期化のローディング/エラー表示を追加"
```

---

### Task 9: 最終確認(ブラウザ動作確認・spec更新・全体検証)

**Files:**
- Modify: `docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md`

**Interfaces:** なし(検証・ドキュメント更新のみ)

- [ ] **Step 1: 全自動テストを実行する**

```bash
bun run test
bun run test:bun
bun run build
bun run lint
```

Expected: 全てPASS/成功。`lint`は既知の`react-hooks/exhaustive-deps`警告(Phase 0からスコープ外)のみ許容する

- [ ] **Step 2: `mise run dev`で実際にブラウザ動作を確認する**

```bash
mise run dev
```

起動したURL(例: `http://localhost:5173/`)をユーザーに開いてもらい、以下を目視確認してもらう:
- 「シミュレーションエンジンを読み込み中...」が一瞬表示された後、アリと巣とランダムな食料が描画されること
- 「開始」ボタンでアリが動き出すこと
- キャンバスをクリックすると新しい食料が追加されること
- アリが食料を見つけて巣に運び、フェロモン(緑/青の円)が徐々に濃くなっていくこと
- 「リセット」ボタンで状態が初期化されること

(このセッションではブラウザ拡張が利用できないため、目視確認はユーザーに依頼すること)

- [ ] **Step 3: spec内のFloat32Array→Float64Arrayの記述ずれを修正する**

Plan A最終レビューで指摘された通り、`docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md`の「データレイアウト」節はフェロモングリッドを`Float32Array`と記載しているが、実装(`pheromone.mbt`)は`FixedArray[Double]`(JS側では`Float64Array`)を使っている。該当箇所を実装に合わせて修正する。

- [ ] **Step 4: specにPlan B完了を記録する**

冒頭のステータス行に追記する:

```markdown
- Plan B(JS側統合): 完了 — `docs/superpowers/plans/2026-08-13-aco-core-js-integration.md`
```

- [ ] **Step 5: コミット**

```bash
git add docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md
git commit -m "docs: Plan B完了をspecに反映、Float32Array記述をFloat64Arrayに修正"
```
