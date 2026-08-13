import { useEffect, useRef, useState } from "react";
import { useSimulationStore } from "@/stores/simulation.store";
import { loadAdapter } from "@/lib/aco-wasm/adapter";
import { SimulationCanvas } from "./SimulationCanvas";
import { ControlPanel } from "./ControlPanel";
import { useSimulation } from "@/hooks/useSimulation";

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

export const ACOSimulation = () => {
  const { initializeSimulation, addRandomFoods } = useSimulationStore();
  const isInitialized = useRef(false);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const wasmUrl = new URL("../../../../wasm-core/dist/aco_core.wasm", import.meta.url);
    loadAdapter(wasmUrl)
      .then(() => {
        initializeSimulation();
        addRandomFoods(10);
        setLoadState({ status: "ready" });
      })
      .catch((error: unknown) => {
        console.error("WASMモジュールの初期化に失敗しました:", error);
        setLoadState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }, [initializeSimulation, addRandomFoods]);

  if (loadState.status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-600">シミュレーションエンジンを読み込み中...</p>
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-red-600">
          シミュレーションエンジンの読み込みに失敗しました: {loadState.message}
        </p>
      </div>
    );
  }

  return <ACOSimulationReady />;
};

const ACOSimulationReady = () => {
  useSimulation();

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-gray-100">
      <div className="flex-1 flex items-center justify-center">
        <SimulationCanvas width={800} height={600} />
      </div>
      <div className="w-full lg:w-96">
        <ControlPanel />
      </div>
    </div>
  );
};
