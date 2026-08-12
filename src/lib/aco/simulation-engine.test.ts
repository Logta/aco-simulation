import { describe, it, expect } from "vitest";
import { executeSimulationStep, executePheromoneDacay } from "./simulation-engine";
import type { SimulationConfig } from "./types";
import type { SimulationState } from "./simulation-engine";

const baseConfig: SimulationConfig = {
  worldWidth: 800,
  worldHeight: 600,
  antCount: 1,
  pheromoneDecayRate: 0.99,
  pheromoneDepositAmount: 2,
  pheromoneTrackingStrength: 0.7,
  speed: 1,
};

describe("executeSimulationStep", () => {
  it("moves a single foraging ant with no food nearby and does not touch foods/pheromones", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 100, y: 100 },
          hasFood: false,
          targetFood: null,
          direction: 0,
          foodAmount: null,
        },
      ],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep(baseConfig, state);

    expect(update.ants).toBeDefined();
    expect(update.ants).toHaveLength(1);
    expect(update.foods).toBeUndefined();
    expect(update.pheromones).toBeUndefined();
  });

  it("drops food and does not deposit pheromone when a returning ant reaches the nest", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 395, y: 295 }, // within NEST_ARRIVAL_RANGE (10) of {400,300}
          hasFood: true,
          targetFood: "food-1",
          direction: 0,
          foodAmount: 10,
        },
      ],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep(baseConfig, state);

    expect(update.ants?.[0]).toMatchObject({
      hasFood: false,
      targetFood: null,
      foodAmount: null,
    });
    expect(update.pheromones).toBeUndefined();
  });

  it("deposits a toFood pheromone when a returning ant is away from the nest", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 100, y: 100 },
          hasFood: true,
          targetFood: "food-1",
          direction: 0,
          foodAmount: 10,
        },
      ],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep(baseConfig, state);

    expect(update.pheromones).toBeDefined();
    expect(update.pheromones!.size).toBe(1);
    expect(Array.from(update.pheromones!.values())[0].type).toBe("toFood");
  });

  it("increases intensity of an existing pheromone when a returning ant deposits onto that cell", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 100, y: 100 },
          hasFood: true,
          targetFood: "food-1",
          direction: 0,
          foodAmount: 10,
        },
      ],
      foods: [],
      pheromones: new Map([
        [
          "10,10", // createPheromoneKey({x:100,y:100}) => floor(100/10),floor(100/10)
          { position: { x: 105, y: 105 }, intensity: 5, type: "toFood" as const },
        ],
      ]),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep(baseConfig, state);

    expect(update.pheromones).toBeDefined();
    expect(update.pheromones!.size).toBe(1);
    expect(update.pheromones!.get("10,10")!.intensity).toBeGreaterThan(5);
  });

  it("reduces food amount when a foraging ant collects it, and updates that ant's state", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 100, y: 100 },
          hasFood: false,
          targetFood: null,
          direction: 0,
          foodAmount: null,
        },
      ],
      foods: [{ id: "food-1", position: { x: 105, y: 105 }, amount: 10 }],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep(baseConfig, state);

    expect(update.foods).toEqual([{ id: "food-1", position: { x: 105, y: 105 }, amount: 9 }]);
    expect(update.ants?.[0]).toMatchObject({ hasFood: true, targetFood: "food-1", foodAmount: 10 });
  });

  it("removes food that reaches zero amount and merges per-ant results across multiple ants", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 100, y: 100 },
          hasFood: false,
          targetFood: null,
          direction: 0,
          foodAmount: null,
        },
        {
          id: "ant-2",
          position: { x: 300, y: 300 },
          hasFood: false,
          targetFood: null,
          direction: 1,
          foodAmount: null,
        },
      ],
      foods: [{ id: "food-1", position: { x: 105, y: 105 }, amount: 1 }],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep({ ...baseConfig, antCount: 2 }, state);

    expect(update.foods).toEqual([]);
    expect(update.ants).toHaveLength(2);
    const updatedIds = update.ants!.map((a) => a.id);
    expect(updatedIds).toEqual(["ant-1", "ant-2"]);
  });
});

describe("executePheromoneDacay", () => {
  it("decays pheromone intensity", () => {
    const pheromones = new Map([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" as const }],
    ]);

    const result = executePheromoneDacay(pheromones, 0.99);

    expect(result.get("1,1")!.intensity).toBeLessThan(50);
  });

  it("does not mutate the original map", () => {
    const pheromones = new Map([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" as const }],
    ]);

    const result = executePheromoneDacay(pheromones, 0.99);

    expect(pheromones.get("1,1")!.intensity).toBe(50);
    expect(result).not.toBe(pheromones);
  });
});
