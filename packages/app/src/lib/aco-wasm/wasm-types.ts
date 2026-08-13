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
