import { describe, it, expect, beforeAll } from "vitest";
import { renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useSimulation } from "./useSimulation";
import { loadAdapterFromBytes, initializeSimulation } from "@/lib/aco-wasm/adapter";

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

beforeAll(async () => {
  const wasmBytes = readFileSync(resolve(import.meta.dirname, "../wasm/aco_core.wasm"));
  await loadAdapterFromBytes(
    wasmBytes.buffer.slice(wasmBytes.byteOffset, wasmBytes.byteOffset + wasmBytes.byteLength),
  );
  initializeSimulation({ antCount: 1, nest: { x: 400, y: 300 }, worldWidth: 800, worldHeight: 600 });
});

describe("useSimulation", () => {
  it("should export useSimulation function", () => {
    expect(typeof useSimulation).toBe("function");
  });

  it("should not throw when rendered", () => {
    expect(() => renderHook(() => useSimulation())).not.toThrow();
  });
});
