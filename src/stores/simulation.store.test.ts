import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// このファイルはstoreがadapterに正しく処理を委譲することだけを検証したいため、
// adapterの実装は呼び出したくない。
//
// 以前はvi.mock(モジュール全体を工場関数の戻り値で置き換える)を使っていたが、
// bun testは全テストファイルを1つのプロセス・1つの共有モジュールレジストリで
// 実行するため、vi.mockはbunの mock.module 相当として動作し、このファイルの
// スコープを超えてadapterモジュールのexportsをプロセス全体で永続的に上書き
// してしまっていた。その結果、src/lib/aco-wasm/adapter.test.tsなど本物の
// adapterを使う他のテストファイルまでこの空のモック関数を掴んでしまい、
// テストファイル単体では再現しないクロスファイルの状態汚染を引き起こしていた
// (vitestはテストファイルごとに独立したモジュールグラフを持つため、この問題は
// vitest実行時には表面化しない)。
//
// vi.spyOn + afterEachでのmockRestoreはモジュールの特定exportだけを一時的に
// 差し替え、テスト終了後に元の実装へ確実に戻す。この仕組みはvitest/bunのどちら
// でも同じように動作し、他のテストファイルへ影響を漏らさない。
import * as adapter from "../lib/aco-wasm/adapter";
import { useSimulationStore } from "./simulation.store";

describe("useSimulationStore", () => {
  beforeEach(() => {
    vi.spyOn(adapter, "initializeSimulation").mockImplementation(() => {});
    vi.spyOn(adapter, "reinitializeAnts").mockImplementation(() => {});
    vi.spyOn(adapter, "addFood").mockImplementation(() => {});
    vi.spyOn(adapter, "addRandomFoods").mockImplementation(() => {});
    vi.spyOn(adapter, "resetAll").mockImplementation(() => {});

    useSimulationStore.setState({
      nest: { x: 400, y: 300 },
      isRunning: false,
      speed: 1,
      antCount: 50,
      pheromoneDecayRate: 0.99,
      pheromoneDepositAmount: 2,
      pheromoneTrackingStrength: 0.7,
      worldWidth: 800,
      worldHeight: 600,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initializeSimulation", () => {
    it("delegates to adapter.initializeSimulation with current settings", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.initializeSimulation();
      });

      expect(adapter.initializeSimulation).toHaveBeenCalledWith({
        antCount: 50,
        nest: { x: 400, y: 300 },
        worldWidth: 800,
        worldHeight: 600,
      });
    });
  });

  describe("toggleSimulation", () => {
    it("toggles isRunning state", () => {
      const { result } = renderHook(() => useSimulationStore());

      expect(result.current.isRunning).toBe(false);
      act(() => {
        result.current.toggleSimulation();
      });
      expect(result.current.isRunning).toBe(true);
    });
  });

  describe("setSpeed", () => {
    it("updates speed", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.setSpeed(2.5);
      });

      expect(result.current.speed).toBe(2.5);
    });
  });

  describe("setAntCount", () => {
    it("updates antCount and delegates to adapter.reinitializeAnts", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.setAntCount(25);
      });

      expect(result.current.antCount).toBe(25);
      expect(adapter.reinitializeAnts).toHaveBeenCalledWith(25);
    });
  });

  describe("food management", () => {
    it("delegates addFood to the adapter", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.addFood({ x: 100, y: 200 });
      });

      expect(adapter.addFood).toHaveBeenCalledWith({ x: 100, y: 200 });
    });

    it("delegates addRandomFoods to the adapter", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.addRandomFoods(5);
      });

      expect(adapter.addRandomFoods).toHaveBeenCalledWith(5);
    });
  });

  describe("reset", () => {
    it("stops the simulation and delegates to adapter.resetAll", () => {
      const { result } = renderHook(() => useSimulationStore());

      act(() => {
        result.current.toggleSimulation();
      });
      expect(result.current.isRunning).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.isRunning).toBe(false);
      expect(adapter.resetAll).toHaveBeenCalledWith({
        antCount: 50,
        nest: { x: 400, y: 300 },
        worldWidth: 800,
        worldHeight: 600,
      });
    });
  });

  describe("pheromone parameters", () => {
    it("updates pheromone decay rate", () => {
      const { result } = renderHook(() => useSimulationStore());
      act(() => {
        result.current.setPheromoneDecayRate(0.95);
      });
      expect(result.current.pheromoneDecayRate).toBe(0.95);
    });

    it("updates pheromone deposit amount", () => {
      const { result } = renderHook(() => useSimulationStore());
      act(() => {
        result.current.setPheromoneDepositAmount(5);
      });
      expect(result.current.pheromoneDepositAmount).toBe(5);
    });

    it("updates pheromone tracking strength", () => {
      const { result } = renderHook(() => useSimulationStore());
      act(() => {
        result.current.setPheromoneTrackingStrength(0.9);
      });
      expect(result.current.pheromoneTrackingStrength).toBe(0.9);
    });
  });
});
