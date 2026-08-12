import { describe, it, expect } from "vitest";
import { torusWrap, torusDistance, normalizeAngle } from "./geometry";

describe("torusWrap", () => {
  it("returns the position unchanged when within bounds", () => {
    expect(torusWrap({ x: 50, y: 30 }, 100, 100)).toEqual({ x: 50, y: 30 });
  });

  it("wraps a position exactly at the boundary to zero", () => {
    expect(torusWrap({ x: 100, y: 100 }, 100, 100)).toEqual({ x: 0, y: 0 });
  });

  it("wraps a negative position to the positive side", () => {
    expect(torusWrap({ x: -10, y: -5 }, 100, 50)).toEqual({ x: 90, y: 45 });
  });

  it("wraps a position that exceeds the world size multiple times", () => {
    expect(torusWrap({ x: 250, y: 130 }, 100, 50)).toEqual({ x: 50, y: 30 });
  });
});

describe("torusDistance", () => {
  it("computes the direct euclidean distance when no wrap is shorter (3-4-5 triangle)", () => {
    expect(torusDistance({ x: 0, y: 0 }, { x: 3, y: 4 }, 100, 100)).toBe(5);
  });

  it("returns 0 for the same point", () => {
    expect(torusDistance({ x: 10, y: 10 }, { x: 10, y: 10 }, 100, 100)).toBe(0);
  });

  it("uses the wrap-around path when it is shorter on the x axis", () => {
    expect(torusDistance({ x: 5, y: 50 }, { x: 95, y: 50 }, 100, 100)).toBe(10);
  });

  it("uses the wrap-around path on both axes", () => {
    expect(torusDistance({ x: 5, y: 5 }, { x: 95, y: 95 }, 100, 100)).toBeCloseTo(
      Math.sqrt(200),
      10,
    );
  });
});

describe("normalizeAngle", () => {
  it("leaves angles already within (-pi, pi] unchanged", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(Math.PI)).toBe(Math.PI);
    expect(normalizeAngle(-Math.PI)).toBe(-Math.PI);
  });

  it("wraps an angle just above pi", () => {
    expect(normalizeAngle(Math.PI + 1)).toBeCloseTo(1 - Math.PI, 10);
  });

  it("wraps an angle just below -pi", () => {
    expect(normalizeAngle(-Math.PI - 1)).toBeCloseTo(Math.PI - 1, 10);
  });

  it("wraps an angle that requires the loop to run (3*pi)", () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 10);
  });
});
