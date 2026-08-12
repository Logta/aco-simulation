import { useEffect, useRef } from "react";
import { useSimulationStore } from "../stores/simulation.store";
import { executeSimulationStep, executePheromoneDacay } from "../lib/aco/simulation-engine";
import type { SimulationUpdate } from "../lib/aco/simulation-engine";

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
    const {
      ants,
      foods,
      pheromones,
      nest,
      worldWidth,
      worldHeight,
      antCount,
      pheromoneDecayRate,
      pheromoneDepositAmount,
      pheromoneTrackingStrength,
      speed,
    } = simulationState;

    const update = executeSimulationStep(
      {
        worldWidth,
        worldHeight,
        antCount,
        pheromoneDecayRate,
        pheromoneDepositAmount,
        pheromoneTrackingStrength,
        speed,
      },
      { ants, foods, pheromones, nest },
    );

    applyUpdate(update, currentTime);
  };

  const applyUpdate = (update: SimulationUpdate, currentTime: number) => {
    useSimulationStore.setState((state) => {
      const next: Partial<typeof state> = {};

      if (update.ants) next.ants = update.ants;
      if (update.foods) next.foods = update.foods;

      let pheromones = update.pheromones ?? state.pheromones;
      if (currentTime - lastDecayTimeRef.current > PHEROMONE_DECAY_INTERVAL_MS) {
        pheromones = executePheromoneDacay(pheromones, state.pheromoneDecayRate);
        lastDecayTimeRef.current = currentTime;
      }
      if (pheromones !== state.pheromones) next.pheromones = pheromones;

      return next;
    });
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    simulationState.isRunning,
    simulationState.speed,
    simulationState.ants,
    simulationState.foods,
    simulationState.pheromones,
  ]);
};
