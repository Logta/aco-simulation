import { executeAntBehavior } from './ant-behavior'
import { decayPheromones } from './pheromone'
import type { Ant, Food, Pheromone, Position, SimulationConfig } from './types'

export type SimulationState = {
  ants: Ant[]
  foods: Food[]
  pheromones: Map<string, Pheromone>
  nest: Position
}

export type SimulationUpdate = {
  ants?: Ant[]
  foods?: Food[]
  pheromones?: Map<string, Pheromone>
}

type AntBehaviorResult = {
  antId: string
  result: ReturnType<typeof executeAntBehavior>
}

/**
 * Execute one simulation step
 * @param config Simulation configuration
 * @param state Current simulation state
 * @returns Updates to be applied to the simulation state
 */
export const executeSimulationStep = (
  config: SimulationConfig,
  state: SimulationState
): SimulationUpdate => {
  const antBehaviorResults = processAllAnts(config, state)
  const updatedState = applyBehaviorResults(state, antBehaviorResults)
  
  return updatedState
}

/**
 * Decay pheromones based on time
 * @param pheromones Current pheromone map
 * @param decayRate Decay rate (0-1)
 * @returns Updated pheromone map
 */
export const executePheromoneDacay = (
  pheromones: Map<string, Pheromone>,
  decayRate: number
): Map<string, Pheromone> => {
  return decayPheromones(pheromones, decayRate)
}

const processAllAnts = (
  config: SimulationConfig,
  state: SimulationState
): AntBehaviorResult[] => {
  return state.ants.map(ant => {
    const result = executeAntBehavior({
      ant,
      foods: state.foods,
      pheromones: state.pheromones,
      nest: state.nest,
      worldWidth: config.worldWidth,
      worldHeight: config.worldHeight,
      pheromoneDepositAmount: config.pheromoneDepositAmount,
      pheromoneTrackingStrength: config.pheromoneTrackingStrength,
      ants: state.ants,
    })

    return {
      antId: ant.id,
      result
    }
  })
}

const applyBehaviorResults = (
  state: SimulationState,
  results: AntBehaviorResult[]
): SimulationUpdate => {
  const update: SimulationUpdate = {}

  // Collect ant updates
  const antUpdates = new Map<string, Partial<Ant>>()
  results.forEach(({ antId, result }) => {
    if (result.antUpdate) {
      antUpdates.set(antId, result.antUpdate)
    }
  })

  if (antUpdates.size > 0) {
    update.ants = state.ants.map(ant => {
      const antUpdate = antUpdates.get(ant.id)
      return antUpdate ? { ...ant, ...antUpdate } : ant
    })
  }

  // Collect pheromone updates
  const pheromoneUpdates = new Map(state.pheromones)
  results.forEach(({ result }) => {
    result.pheromoneUpdates.forEach((pheromone: Pheromone, key: string) => {
      pheromoneUpdates.set(key, pheromone)
    })
  })

  if (pheromoneUpdates.size !== state.pheromones.size) {
    update.pheromones = pheromoneUpdates
  }

  // Collect food updates
  const foodsToRemove = new Set<string>()
  const foodAmountUpdates = new Map<string, number>()
  
  results.forEach(({ result }) => {
    if (result.removeFood) {
      foodsToRemove.add(result.removeFood)
    }
    if (result.foodUpdate) {
      foodAmountUpdates.set(result.foodUpdate.id, result.foodUpdate.amount)
    }
  })

  if (foodsToRemove.size > 0 || foodAmountUpdates.size > 0) {
    update.foods = state.foods
      .filter(food => !foodsToRemove.has(food.id))
      .map(food => {
        const newAmount = foodAmountUpdates.get(food.id)
        return newAmount !== undefined ? { ...food, amount: newAmount } : food
      })
  }

  return update
}