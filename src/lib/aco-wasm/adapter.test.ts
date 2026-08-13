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
