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
  const response = await fetch(wasmUrl);
  const wasm = await instantiateStreamingFrom(response);
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
