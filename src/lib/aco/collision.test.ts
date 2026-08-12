import { describe, it, expect } from "vitest";
import { avoidCollisions } from "./collision";

describe("avoidCollisions", () => {
  it("returns the direction and position unchanged when there are no other ants", () => {
    const result = avoidCollisions({ x: 50, y: 50 }, 0, [], "a1", 100, 100);
    expect(result).toEqual({ direction: 0, position: { x: 50, y: 50 } });
  });

  it("excludes the current ant itself from collision checks", () => {
    const result = avoidCollisions(
      { x: 50, y: 50 },
      0,
      [{ id: "a1", position: { x: 52, y: 50 } }],
      "a1",
      100,
      100,
    );
    expect(result).toEqual({ direction: 0, position: { x: 50, y: 50 } });
  });

  it("ignores ants outside the avoidance radius", () => {
    const result = avoidCollisions(
      { x: 50, y: 50 },
      0,
      [{ id: "a2", position: { x: 70, y: 50 } }],
      "a1",
      100,
      100,
    );
    expect(result).toEqual({ direction: 0, position: { x: 50, y: 50 } });
  });

  it("steers away from a single nearby ant using the default params", () => {
    const result = avoidCollisions(
      { x: 50, y: 50 },
      0,
      [{ id: "a2", position: { x: 54, y: 50 } }],
      "a1",
      100,
      100,
    );
    expect(result.direction).toBeCloseTo(Math.PI / 2, 10);
    expect(result.position.x).toBeCloseTo(49.875, 10);
    expect(result.position.y).toBeCloseTo(50, 10);
  });

  it("respects custom avoidanceRadius and avoidanceStrength params", () => {
    const result = avoidCollisions(
      { x: 50, y: 50 },
      0,
      [{ id: "a2", position: { x: 54, y: 50 } }],
      "a1",
      100,
      100,
      { avoidanceRadius: 10, avoidanceStrength: 1 },
    );
    expect(result.direction).toBeCloseTo(Math.PI, 10);
    expect(result.position.x).toBeCloseTo(49.7, 10);
    expect(result.position.y).toBeCloseTo(50, 10);
  });

  it("accumulates avoidance force from multiple nearby ants and caps the strength at 1", () => {
    const result = avoidCollisions(
      { x: 50, y: 50 },
      0,
      [
        { id: "a2", position: { x: 54, y: 50 } },
        { id: "a3", position: { x: 50, y: 54 } },
      ],
      "a1",
      100,
      100,
    );
    expect(result.direction).toBeCloseTo((-3 * Math.PI) / 4, 10);
    expect(result.position.x).toBeCloseTo(49.75, 10);
    expect(result.position.y).toBeCloseTo(49.75, 10);
  });

  it("computes avoidance across the torus wrap boundary", () => {
    const result = avoidCollisions(
      { x: 2, y: 50 },
      0,
      [{ id: "a2", position: { x: 98, y: 50 } }],
      "a1",
      100,
      100,
    );
    expect(result.direction).toBeCloseTo(0, 10);
    expect(result.position.x).toBeCloseTo(2.125, 10);
    expect(result.position.y).toBeCloseTo(50, 10);
  });
});
