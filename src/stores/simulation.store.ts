import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Position, Food, Ant, Pheromone, SimulationConfig } from '@/lib/aco/types'

type SimulationState = {
  ants: Ant[]
  foods: Food[]
  pheromones: Map<string, Pheromone>
  nest: Position
  isRunning: boolean
  speed: number
  antCount: number
  pheromoneDecayRate: number
  pheromoneDepositAmount: number
  worldWidth: number
  worldHeight: number
}

type SimulationActions = {
  initializeSimulation: () => void
  toggleSimulation: () => void
  setSpeed: (speed: number) => void
  setAntCount: (count: number) => void
  setPheromoneDecayRate: (rate: number) => void
  setPheromoneDepositAmount: (amount: number) => void
  addFood: (position: Position) => void
  removeFood: (id: string) => void
  addRandomFoods: (count: number) => void
  updateAnt: (id: string, updates: Partial<Ant>) => void
  updatePheromone: (key: string, pheromone: Pheromone) => void
  decayPheromones: () => void
  reset: () => void
}

export const useSimulationStore = create<SimulationState & SimulationActions>()(
  devtools(
    (set, get) => ({
      ants: [],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
      isRunning: false,
      speed: 1,
      antCount: 50,
      pheromoneDecayRate: 0.99,
      pheromoneDepositAmount: 1,
      worldWidth: 800,
      worldHeight: 600,

      initializeSimulation: () => {
        const { antCount, nest, worldWidth, worldHeight } = get()
        const newAnts: Ant[] = []
        
        for (let i = 0; i < antCount; i++) {
          newAnts.push({
            id: `ant-${i}`,
            position: { ...nest },
            hasFood: false,
            targetFood: null,
            direction: Math.random() * Math.PI * 2,
          })
        }

        set({
          ants: newAnts,
          pheromones: new Map(),
        })
      },

      toggleSimulation: () => {
        set((state) => ({ isRunning: !state.isRunning }))
      },

      setSpeed: (speed) => {
        set({ speed })
      },

      setAntCount: (count) => {
        set({ antCount: count })
        get().initializeSimulation()
      },

      setPheromoneDecayRate: (rate) => {
        set({ pheromoneDecayRate: rate })
      },

      setPheromoneDepositAmount: (amount) => {
        set({ pheromoneDepositAmount: amount })
      },

      addFood: (position) => {
        const id = `food-${Date.now()}-${Math.random()}`
        set((state) => ({
          foods: [...state.foods, { id, position, amount: 100 }],
        }))
      },

      removeFood: (id) => {
        set((state) => ({
          foods: state.foods.filter((f) => f.id !== id),
        }))
      },

      addRandomFoods: (count) => {
        const { worldWidth, worldHeight } = get()
        const newFoods: Food[] = []
        
        for (let i = 0; i < count; i++) {
          newFoods.push({
            id: `food-${Date.now()}-${i}`,
            position: {
              x: Math.random() * worldWidth,
              y: Math.random() * worldHeight,
            },
            amount: 50 + Math.random() * 100,
          })
        }

        set((state) => ({
          foods: [...state.foods, ...newFoods],
        }))
      },

      updateAnt: (id, updates) => {
        set((state) => ({
          ants: state.ants.map((ant) =>
            ant.id === id ? { ...ant, ...updates } : ant
          ),
        }))
      },

      updatePheromone: (key, pheromone) => {
        set((state) => {
          const newPheromones = new Map(state.pheromones)
          newPheromones.set(key, pheromone)
          return { pheromones: newPheromones }
        })
      },

      decayPheromones: () => {
        const { pheromoneDecayRate } = get()
        set((state) => {
          const newPheromones = new Map()
          state.pheromones.forEach((pheromone, key) => {
            const decayedIntensity = pheromone.intensity * pheromoneDecayRate
            if (decayedIntensity > 0.01) {
              newPheromones.set(key, {
                ...pheromone,
                intensity: decayedIntensity,
              })
            }
          })
          return { pheromones: newPheromones }
        })
      },

      reset: () => {
        set({
          ants: [],
          foods: [],
          pheromones: new Map(),
          isRunning: false,
        })
        get().initializeSimulation()
      },
    }),
    {
      name: 'aco-simulation',
    }
  )
)