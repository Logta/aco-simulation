import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAdapterFromBytes, initializeSimulation, getRenderView, reinitializeAnts, addFood, addRandomFoods, resetAll, stepSimulation, decaySimulation } from "./adapter";

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

  it("zeroes the pheromone grids in place without reallocating them (avoids leaking WASM memory on repeated calls, e.g. slider drags)", () => {
    initializeSimulation({ antCount: 3, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });
    const before = getRenderView();
    // フェロモングリッドに直接値を書き込む(テスト専用の内部アクセス)。
    before.pheromoneToFood[10] = 42;
    before.pheromoneToNest[20] = 42;
    const toFoodOffsetBefore = before.pheromoneToFood.byteOffset;
    const toNestOffsetBefore = before.pheromoneToNest.byteOffset;

    reinitializeAnts(7);

    const after = getRenderView();
    // ポインタ(バッファ内オフセット)は変わらない = 再確保されていない。
    expect(after.pheromoneToFood.byteOffset).toBe(toFoodOffsetBefore);
    expect(after.pheromoneToNest.byteOffset).toBe(toNestOffsetBefore);
    // 内容はゼロクリアされている。
    expect(after.pheromoneToFood.every((v) => v === 0)).toBe(true);
    expect(after.pheromoneToNest.every((v) => v === 0)).toBe(true);
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
