import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSimulation } from "./useSimulation";

describe("useSimulation", () => {
  it("should export useSimulation function", () => {
    expect(typeof useSimulation).toBe("function");
  });

  it("should not throw when rendered", () => {
    expect(() => renderHook(() => useSimulation())).not.toThrow();
  });
});
