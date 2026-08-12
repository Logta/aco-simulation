import { describe, it, expect } from "vitest";
import { followPheromone, findNearestTarget, getTargetsInRadius } from "./pathfinding";
import type { Pheromone } from "./types";

describe("followPheromone", () => {
  it("keeps the direction unchanged when no pheromone of the target type exists", () => {
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 20, y: 0 }, intensity: 100, type: "toNest" }],
    ]);
    expect(followPheromone({ x: 0, y: 0 }, map, "toFood", 0.5, 100, 100)).toBe(0.5);
  });

  it("keeps the direction unchanged when all sensors are out of detection range", () => {
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 1000, y: 1000 }, intensity: 100, type: "toFood" }],
    ]);
    expect(followPheromone({ x: 0, y: 0 }, map, "toFood", 1.23, 100, 100)).toBe(1.23);
  });

  it("keeps direction unchanged when the strongest signal is at the center sensor", () => {
    // Center sensor position for direction=0 is exactly (20, 0) — place the pheromone there.
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 20, y: 0 }, intensity: 100, type: "toFood" }],
    ]);
    expect(followPheromone({ x: 0, y: 0 }, map, "toFood", 0, 100, 100)).toBe(0);
  });

  it("steers toward the left sensor when the strongest signal is there", () => {
    // Left sensor position for direction=0 is (20*cos(-pi/4), 20*sin(-pi/4)).
    const leftSensorPos = { x: 20 * Math.cos(-Math.PI / 4), y: 20 * Math.sin(-Math.PI / 4) };
    const map = new Map<string, Pheromone>([
      ["k", { position: leftSensorPos, intensity: 100, type: "toFood" }],
    ]);
    expect(followPheromone({ x: 0, y: 0 }, map, "toFood", 0, 100, 100)).toBe(-Math.PI / 4);
  });
});

describe("findNearestTarget", () => {
  it("returns the closest target among several", () => {
    const targets = [
      { position: { x: 10, y: 0 } },
      { position: { x: 5, y: 0 } },
      { position: { x: 20, y: 0 } },
    ];
    expect(findNearestTarget({ x: 0, y: 0 }, targets, 100, 100)).toBe(targets[1]);
  });

  it("returns null when there are no targets", () => {
    expect(findNearestTarget({ x: 0, y: 0 }, [], 100, 100)).toBeNull();
  });

  it("returns null when the nearest target is beyond maxDistance", () => {
    const targets = [{ position: { x: 50, y: 0 } }];
    expect(findNearestTarget({ x: 0, y: 0 }, targets, 100, 100, 10)).toBeNull();
  });

  it("returns the target when it is within maxDistance", () => {
    const targets = [{ position: { x: 5, y: 0 } }];
    expect(findNearestTarget({ x: 0, y: 0 }, targets, 100, 100, 10)).toBe(targets[0]);
  });

  it("uses torus-aware distance to find a target across the wrap boundary", () => {
    const targets = [{ position: { x: 98, y: 0 } }];
    expect(findNearestTarget({ x: 2, y: 0 }, targets, 100, 100, 10)).toBe(targets[0]);
  });
});

describe("getTargetsInRadius", () => {
  it("includes targets within the radius and excludes those beyond it (radius is inclusive)", () => {
    const near = { position: { x: 5, y: 0 }, label: "near" };
    const atRadius = { position: { x: 10, y: 0 }, label: "atRadius" };
    const beyond = { position: { x: 15, y: 0 }, label: "beyond" };
    const result = getTargetsInRadius({ x: 0, y: 0 }, [near, atRadius, beyond], 10, 1000, 1000);
    expect(result).toEqual([near, atRadius]);
  });

  it("returns an empty array when nothing is within radius", () => {
    const targets = [{ position: { x: 500, y: 0 } }];
    expect(getTargetsInRadius({ x: 0, y: 0 }, targets, 10, 1000, 1000)).toEqual([]);
  });

  it("uses torus-aware distance across the wrap boundary", () => {
    const targets = [{ position: { x: 98, y: 0 } }];
    expect(getTargetsInRadius({ x: 2, y: 0 }, targets, 10, 100, 100)).toEqual(targets);
  });
});
