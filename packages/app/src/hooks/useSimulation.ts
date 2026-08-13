import { useEffect, useRef } from "react";
import { useSimulationStore } from "../stores/simulation.store";
import { stepSimulation, decaySimulation } from "../lib/aco-wasm/adapter";

const FRAME_DELAY_MS = 50;
const PHEROMONE_DECAY_INTERVAL_MS = 500;

export const useSimulation = () => {
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastDecayTimeRef = useRef<number>(0);

  const simulationState = useSimulationStore();
  // RAFループ(useEffect内)は毎フレーム実行されるが、simulationStateの変化のたびに
  // effectを再実行してループを再起動したくない(cancel + reschedule のオーバーヘッドと、
  // それに伴うreact-hooks/exhaustive-deps警告を避けるため)。そこでrefに最新値を
  // 保持し、ループ内では常にref経由で最新のisRunning/speedを読む。
  const simulationStateRef = useRef(simulationState);
  simulationStateRef.current = simulationState;

  useEffect(() => {
    const performSimulationStep = (currentTime: number) => {
      const { pheromoneDepositAmount, pheromoneTrackingStrength, pheromoneDecayRate } =
        useSimulationStore.getState();

      stepSimulation({ pheromoneDepositAmount, pheromoneTrackingStrength });

      if (currentTime - lastDecayTimeRef.current > PHEROMONE_DECAY_INTERVAL_MS) {
        decaySimulation(pheromoneDecayRate);
        lastDecayTimeRef.current = currentTime;
      }
    };

    const animate = (currentTime: number) => {
      const state = simulationStateRef.current;

      if (!state.isRunning) {
        lastTimeRef.current = currentTime;
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = currentTime - lastTimeRef.current;

      if (deltaTime > FRAME_DELAY_MS / state.speed) {
        performSimulationStep(currentTime);
        lastTimeRef.current = currentTime;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
};
