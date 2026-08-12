import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSimulation } from "./useSimulation";

// bun-test-setup.tsが提供するjsdom環境はrequestAnimationFrame/cancelAnimationFrameを
// globalに公開していないため、このテストファイル内に限定したポリフィルを用意する
// (vitest実行時はjsdom環境が標準で提供するため、未定義の場合のみ設定する)。
if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    return setTimeout(() => callback(Date.now()), 0) as unknown as number;
  }) as typeof requestAnimationFrame;
}
if (typeof globalThis.cancelAnimationFrame === "undefined") {
  globalThis.cancelAnimationFrame = ((handle: number): void => {
    clearTimeout(handle);
  }) as typeof cancelAnimationFrame;
}

describe("useSimulation", () => {
  it("should export useSimulation function", () => {
    expect(typeof useSimulation).toBe("function");
  });

  it("should not throw when rendered", () => {
    expect(() => renderHook(() => useSimulation())).not.toThrow();
  });
});
