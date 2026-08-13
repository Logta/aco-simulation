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
