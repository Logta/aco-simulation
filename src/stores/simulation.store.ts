import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  initializeSimulation as adapterInitializeSimulation,
  reinitializeAnts,
  addFood as adapterAddFood,
  addRandomFoods as adapterAddRandomFoods,
  resetAll,
} from "../lib/aco-wasm/adapter";
import type { Position } from "../lib/aco-wasm/adapter";

type SimulationState = {
  nest: Position;
  isRunning: boolean;
  speed: number;
  antCount: number;
  pheromoneDecayRate: number;
  pheromoneDepositAmount: number;
  pheromoneTrackingStrength: number;
  worldWidth: number;
  worldHeight: number;
};

type SimulationActions = {
  initializeSimulation: () => void;
  toggleSimulation: () => void;
  setSpeed: (speed: number) => void;
  setAntCount: (count: number) => void;
  setPheromoneDecayRate: (rate: number) => void;
  setPheromoneDepositAmount: (amount: number) => void;
  setPheromoneTrackingStrength: (strength: number) => void;
  addFood: (position: Position) => void;
  addRandomFoods: (count: number) => void;
  reset: () => void;
};

export const useSimulationStore = create<SimulationState & SimulationActions>()(
  devtools(
    (set, get) => ({
      nest: { x: 400, y: 300 },
      isRunning: false,
      speed: 1,
      antCount: 50,
      pheromoneDecayRate: 0.99,
      pheromoneDepositAmount: 2,
      pheromoneTrackingStrength: 0.7,
      worldWidth: 800,
      worldHeight: 600,

      initializeSimulation: () => {
        const { antCount, nest, worldWidth, worldHeight } = get();
        adapterInitializeSimulation({ antCount, nest, worldWidth, worldHeight });
      },

      toggleSimulation: () => {
        set((state) => ({ isRunning: !state.isRunning }));
      },

      setSpeed: (speed) => {
        set({ speed });
      },

      setAntCount: (count) => {
        set({ antCount: count });
        reinitializeAnts(count);
      },

      setPheromoneDecayRate: (rate) => {
        set({ pheromoneDecayRate: rate });
      },

      setPheromoneDepositAmount: (amount) => {
        set({ pheromoneDepositAmount: amount });
      },

      setPheromoneTrackingStrength: (strength) => {
        set({ pheromoneTrackingStrength: strength });
      },

      addFood: (position) => {
        adapterAddFood(position);
      },

      addRandomFoods: (count) => {
        adapterAddRandomFoods(count);
      },

      reset: () => {
        const { antCount, nest, worldWidth, worldHeight } = get();
        set({ isRunning: false });
        resetAll({ antCount, nest, worldWidth, worldHeight });
      },
    }),
    {
      name: "aco-simulation",
    },
  ),
);
