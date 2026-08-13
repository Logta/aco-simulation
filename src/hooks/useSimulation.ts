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

  const animate = (currentTime: number) => {
    if (!simulationState.isRunning) {
      lastTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const deltaTime = currentTime - lastTimeRef.current;

    if (deltaTime > FRAME_DELAY_MS / simulationState.speed) {
      performSimulationStep(currentTime);
      lastTimeRef.current = currentTime;
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const performSimulationStep = (currentTime: number) => {
    const { pheromoneDepositAmount, pheromoneTrackingStrength, pheromoneDecayRate } =
      useSimulationStore.getState();

    stepSimulation({ pheromoneDepositAmount, pheromoneTrackingStrength });

    if (currentTime - lastDecayTimeRef.current > PHEROMONE_DECAY_INTERVAL_MS) {
      decaySimulation(pheromoneDecayRate);
      lastDecayTimeRef.current = currentTime;
    }
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [simulationState.isRunning, simulationState.speed]);
};
