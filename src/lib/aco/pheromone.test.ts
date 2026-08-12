import { describe, it, expect } from "vitest";
import { createPheromoneKey, depositPheromone, decayPheromones, getPheromoneStrength } from "./pheromone";
import type { Pheromone } from "./types";

describe("createPheromoneKey", () => {
  it("floors the position to a 10px grid cell", () => {
    expect(createPheromoneKey({ x: 23, y: 47 })).toBe("2,4");
  });

  it("handles the origin", () => {
    expect(createPheromoneKey({ x: 0, y: 0 })).toBe("0,0");
  });

  it("handles negative coordinates", () => {
    expect(createPheromoneKey({ x: -5, y: 15 })).toBe("-1,1");
  });
});

describe("depositPheromone", () => {
  it("creates a new pheromone snapped to the cell center when none exists", () => {
    const result = depositPheromone(new Map(), { x: 23, y: 47 }, "toFood", 5);
    expect(result.size).toBe(1);
    expect(result.get("2,4")).toEqual({
      position: { x: 25, y: 45 },
      intensity: 5,
      type: "toFood",
    });
  });

  it("accumulates intensity onto an existing pheromone", () => {
    const existing = new Map<string, Pheromone>([
      ["2,4", { position: { x: 25, y: 45 }, intensity: 90, type: "toFood" }],
    ]);
    const result = depositPheromone(existing, { x: 23, y: 47 }, "toFood", 5);
    expect(result.get("2,4")).toEqual({
      position: { x: 25, y: 45 },
      intensity: 95,
      type: "toFood",
    });
  });

  it("caps accumulated intensity at 100", () => {
    const existing = new Map<string, Pheromone>([
      ["2,4", { position: { x: 25, y: 45 }, intensity: 98, type: "toFood" }],
    ]);
    const result = depositPheromone(existing, { x: 23, y: 47 }, "toFood", 5);
    expect(result.get("2,4")?.intensity).toBe(100);
  });

  it("does not mutate the original map", () => {
    const original = new Map<string, Pheromone>();
    const result = depositPheromone(original, { x: 23, y: 47 }, "toFood", 5);
    expect(original.size).toBe(0);
    expect(result.size).toBe(1);
    expect(result).not.toBe(original);
  });

  it("keeps the existing pheromone's type when depositing a different type onto it (documented current behavior)", () => {
    // 既存挙動の確認: depositPheromoneは既存エントリの`type`を新しい引数で上書きしない。
    // 呼び出し側(ant-behavior.ts)は常に同じtypeで同じ位置に積むため実害はないが、
    // APIとしては直感に反するため、この仕様を明示的に固定しておく。
    const existing = new Map<string, Pheromone>([
      ["2,4", { position: { x: 25, y: 45 }, intensity: 10, type: "toFood" }],
    ]);
    const result = depositPheromone(existing, { x: 23, y: 47 }, "toNest", 5);
    expect(result.get("2,4")?.type).toBe("toFood");
  });
});

describe("decayPheromones", () => {
  it("reduces intensity and keeps the pheromone when above the threshold", () => {
    const map = new Map<string, Pheromone>([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" }],
    ]);
    const result = decayPheromones(map, 0.99);
    const decayed = result.get("1,1");
    expect(decayed).toBeDefined();
    expect(decayed!.intensity).toBeLessThan(50);
    expect(decayed!.intensity).toBeGreaterThan(0);
  });

  it("removes a pheromone whose intensity decays below the threshold", () => {
    const map = new Map<string, Pheromone>([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 0.05, type: "toFood" }],
    ]);
    const result = decayPheromones(map, 0.5);
    expect(result.has("1,1")).toBe(false);
  });

  it("does not mutate the original map", () => {
    const original = new Map<string, Pheromone>([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" }],
    ]);
    const result = decayPheromones(original, 0.99);
    expect(original.get("1,1")?.intensity).toBe(50);
    expect(result).not.toBe(original);
  });

  it("decays multiple pheromones independently", () => {
    const map = new Map<string, Pheromone>([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" }],
      ["2,2", { position: { x: 25, y: 25 }, intensity: 80, type: "toNest" }],
    ]);
    const result = decayPheromones(map, 0.95);
    expect(result.get("1,1")!.intensity).toBeLessThan(50);
    expect(result.get("2,2")!.intensity).toBeLessThan(80);
  });

  it("evaporates less with a higher decayRate (weaker evaporation)", () => {
    const map = new Map<string, Pheromone>([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" }],
    ]);
    const strong = decayPheromones(map, 0.9).get("1,1")!.intensity;
    const weak = decayPheromones(map, 0.999).get("1,1")!.intensity;
    expect(weak).toBeGreaterThan(strong);
  });
});

describe("getPheromoneStrength", () => {
  it("returns 0 for an empty map", () => {
    expect(getPheromoneStrength(new Map(), { x: 0, y: 0 }, "toFood")).toBe(0);
  });

  it("computes strength from a single matching pheromone within range", () => {
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 10, y: 0 }, intensity: 60, type: "toFood" }],
    ]);
    expect(getPheromoneStrength(map, { x: 0, y: 0 }, "toFood")).toBeCloseTo(60 / 11, 10);
  });

  it("excludes pheromones at or beyond the 30-unit detection radius", () => {
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 30, y: 0 }, intensity: 60, type: "toFood" }],
    ]);
    expect(getPheromoneStrength(map, { x: 0, y: 0 }, "toFood")).toBe(0);
  });

  it("excludes pheromones of a different type", () => {
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 10, y: 0 }, intensity: 60, type: "toNest" }],
    ]);
    expect(getPheromoneStrength(map, { x: 0, y: 0 }, "toFood")).toBe(0);
  });

  it("sums strength across multiple matching pheromones", () => {
    const map = new Map<string, Pheromone>([
      ["a", { position: { x: 0, y: 0 }, intensity: 20, type: "toFood" }],
      ["b", { position: { x: 10, y: 0 }, intensity: 60, type: "toFood" }],
    ]);
    expect(getPheromoneStrength(map, { x: 0, y: 0 }, "toFood")).toBeCloseTo(20 + 60 / 11, 10);
  });
});
