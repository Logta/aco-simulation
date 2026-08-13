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
