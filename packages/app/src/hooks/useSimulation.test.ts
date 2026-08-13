import { describe, it, expect, beforeAll } from "vitest";
import { renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useSimulation } from "./useSimulation";
import { loadAdapterFromBytes, initializeSimulation } from "../lib/aco-wasm/adapter";

beforeAll(async () => {
  const wasmBytes = readFileSync(resolve(import.meta.dirname, "../../../wasm-core/dist/aco_core.wasm"));
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
    let renderResult: ReturnType<typeof renderHook> | undefined;

    expect(() => {
      renderResult = renderHook(() => useSimulation());
    }).not.toThrow();

    // useSimulationはuseEffect内でrequestAnimationFrameの再帰ループを開始する。
    // 明示的にunmountしないと(bun testの共有モジュールレジストリ配下では
    // 特に)このループが後続のテストファイルまで動き続け、実アダプタの
    // モジュール単位状態を汚染してしまう。
    renderResult?.unmount();
  });
});
