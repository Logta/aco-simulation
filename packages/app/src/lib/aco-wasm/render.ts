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
