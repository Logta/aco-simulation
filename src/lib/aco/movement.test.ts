import { describe, it, expect, vi, afterEach } from "vitest";
import { moveAnt, moveTowardsTarget, moveWithBias } from "./movement";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("moveTowardsTarget", () => {
  it("returns the target directly once within speed distance", () => {
    const target = { x: 1, y: 0 };
    expect(moveTowardsTarget({ x: 0, y: 0 }, target, 100, 100, 2)).toEqual(target);
  });

  it("moves toward a distant target by exactly `speed` units", () => {
    expect(moveTowardsTarget({ x: 0, y: 0 }, { x: 10, y: 0 }, 100, 100, 2)).toEqual({
      x: 2,
      y: 0,
    });
  });

  it("lands exactly on the target when distance equals speed", () => {
    expect(moveTowardsTarget({ x: 0, y: 0 }, { x: 3, y: 4 }, 100, 100, 5)).toEqual({
      x: 3,
      y: 4,
    });
  });

  it("takes the shorter path across the torus wrap boundary", () => {
    expect(moveTowardsTarget({ x: 5, y: 50 }, { x: 95, y: 50 }, 100, 100, 2)).toEqual({
      x: 3,
      y: 50,
    });
  });
});

describe("moveAnt", () => {
  it("moves in a straight line when randomTurnRange is 0", () => {
    const result = moveAnt({ x: 0, y: 0 }, 0, 100, 100, { speed: 2, randomTurnRange: 0 });
    expect(result.direction).toBe(0);
    expect(result.position.x).toBeCloseTo(2, 10);
    expect(result.position.y).toBeCloseTo(0, 10);
  });

  it("uses the default speed and randomTurnRange when params are omitted", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // (0.5 - 0.5) * range = 0, no turn
    const result = moveAnt({ x: 10, y: 10 }, Math.PI / 2, 100, 100);
    expect(result.direction).toBeCloseTo(Math.PI / 2, 10);
    expect(result.position.x).toBeCloseTo(10, 5);
    expect(result.position.y).toBeCloseTo(12, 10);
  });

  it("applies a random turn proportional to randomTurnRange", () => {
    vi.spyOn(Math, "random").mockReturnValue(1); // (1 - 0.5) * 0.5 = 0.25 turn
    const result = moveAnt({ x: 0, y: 0 }, 0, 100, 100, { speed: 2, randomTurnRange: 0.5 });
    expect(result.direction).toBeCloseTo(0.25, 10);
    expect(result.position.x).toBeCloseTo(Math.cos(0.25) * 2, 10);
    expect(result.position.y).toBeCloseTo(Math.sin(0.25) * 2, 10);
  });
});

describe("moveWithBias", () => {
  it("keeps direction unchanged when already aligned with the target and no randomness", () => {
    const result = moveWithBias({ x: 0, y: 0 }, 0, { x: 10, y: 0 }, 100, 100, {
      speed: 2,
      randomTurnRange: 0,
      biasStrength: 0.3,
    });
    expect(result.direction).toBe(0);
    expect(result.position.x).toBeCloseTo(2, 10);
    expect(result.position.y).toBeCloseTo(0, 10);
  });

  it("blends toward the target direction proportional to biasStrength", () => {
    const result = moveWithBias({ x: 0, y: 0 }, 0, { x: 0, y: 10 }, 100, 100, {
      speed: 2,
      randomTurnRange: 0,
      biasStrength: 0.5,
    });
    expect(result.direction).toBeCloseTo(Math.PI / 4, 10);
    expect(result.position.x).toBeCloseTo(Math.cos(Math.PI / 4) * 2, 10);
    expect(result.position.y).toBeCloseTo(Math.sin(Math.PI / 4) * 2, 10);
  });

  it("applies the random turn scaled by (1 - biasStrength) when biasStrength is 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(1); // (1 - 0.5) * 0.4 = 0.2 turn
    const result = moveWithBias({ x: 0, y: 0 }, 0, { x: 10, y: 0 }, 100, 100, {
      speed: 2,
      randomTurnRange: 0.4,
      biasStrength: 0,
    });
    expect(result.direction).toBeCloseTo(0.2, 10);
    expect(result.position.x).toBeCloseTo(Math.cos(0.2) * 2, 10);
    expect(result.position.y).toBeCloseTo(Math.sin(0.2) * 2, 10);
  });
});
