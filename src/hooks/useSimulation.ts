import { useEffect, useRef } from 'react'
import { useSimulationStore } from '@/stores/simulation.store'
import { executeAntBehavior } from '@/lib/aco/ant-behavior'
import { decayPheromones } from '@/lib/aco/pheromone'
import type { Ant, Food, Pheromone, Position } from '@/lib/aco/types'

// Configuration constants
const FRAME_DELAY_MS = 50
const PHEROMONE_DECAY_INTERVAL_MS = 500

export const useSimulation = () => {
  const animationFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const lastDecayTimeRef = useRef<number>(0)
  
  const simulationState = useSimulationStore()

  const animate = (currentTime: number) => {
    if (!simulationState.isRunning) {
      lastTimeRef.current = currentTime
      animationFrameRef.current = requestAnimationFrame(animate)
      return
    }

    const deltaTime = currentTime - lastTimeRef.current
    
    if (deltaTime > FRAME_DELAY_MS / simulationState.speed) {
      performSimulationStep(currentTime)
      lastTimeRef.current = currentTime
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }

  const performSimulationStep = (currentTime: number) => {
    const {
      ants,
      foods,
      pheromones,
      nest,
      worldWidth,
      worldHeight,
      pheromoneDecayRate,
      pheromoneDepositAmount,
      pheromoneTrackingStrength,
    } = simulationState

    // Process all ants and collect updates
    const updates = processAnts({
      ants,
      foods,
      pheromones,
      nest,
      worldWidth,
      worldHeight,
      pheromoneDepositAmount,
      pheromoneTrackingStrength,
    })

    // Apply all updates in a single state change
    applyUpdates(updates, currentTime)
  }

  const processAnts = (context: {
    ants: Ant[]
    foods: Food[]
    pheromones: Map<string, Pheromone>
    nest: Position
    worldWidth: number
    worldHeight: number
    pheromoneDepositAmount: number
    pheromoneTrackingStrength: number
  }) => {
    const antUpdates: Array<{ id: string; updates: Partial<Ant> }> = []
    const pheromoneUpdates = new Map<string, Pheromone>()
    const foodUpdates: Array<{ id: string; updates: Partial<Food> }> = []
    const foodsToRemove: string[] = []

    context.ants.forEach(ant => {
      const result = executeAntBehavior({
        ant,
        foods: context.foods,
        pheromones: context.pheromones,
        nest: context.nest,
        worldWidth: context.worldWidth,
        worldHeight: context.worldHeight,
        pheromoneDepositAmount: context.pheromoneDepositAmount,
        pheromoneTrackingStrength: context.pheromoneTrackingStrength,
        ants: context.ants,
      })

      // Collect ant updates
      if (result.antUpdate) {
        antUpdates.push({ id: ant.id, updates: result.antUpdate })
      }

      // Merge pheromone updates
      result.pheromoneUpdates.forEach((pheromone: Pheromone, key: string) => {
        pheromoneUpdates.set(key, pheromone)
      })

      // Collect food updates
      if (result.foodUpdate) {
        foodUpdates.push({ id: result.foodUpdate.id, updates: { amount: result.foodUpdate.amount } })
      }
      if (result.removeFood) {
        foodsToRemove.push(result.removeFood)
      }
    })

    return { antUpdates, pheromoneUpdates, foodUpdates, foodsToRemove }
  }

  const applyUpdates = (
    updates: {
      antUpdates: Array<{ id: string; updates: Partial<Ant> }>
      pheromoneUpdates: Map<string, Pheromone>
      foodUpdates: Array<{ id: string; updates: Partial<Food> }>
      foodsToRemove: string[]
    },
    currentTime: number
  ) => {
    useSimulationStore.setState((state) => {
      // Update ants
      const newAnts = state.ants.map(ant => {
        const update = updates.antUpdates.find(u => u.id === ant.id)
        return update ? { ...ant, ...update.updates } : ant
      })
      
      // Update foods
      let newFoods = state.foods
      if (updates.foodUpdates.length > 0 || updates.foodsToRemove.length > 0) {
        newFoods = state.foods
          .filter(f => !updates.foodsToRemove.includes(f.id))
          .map(food => {
            const update = updates.foodUpdates.find(u => u.id === food.id)
            return update ? { ...food, ...update.updates } : food
          })
      }
      
      // Update pheromones
      const newPheromones = new Map(state.pheromones)
      updates.pheromoneUpdates.forEach((pheromone: Pheromone, key: string) => {
        newPheromones.set(key, pheromone)
      })
      
      // Decay pheromones periodically
      let finalPheromones = newPheromones
      if (currentTime - lastDecayTimeRef.current > PHEROMONE_DECAY_INTERVAL_MS) {
        finalPheromones = decayPheromones(newPheromones, state.pheromoneDecayRate)
        lastDecayTimeRef.current = currentTime
      }
      
      return {
        ants: newAnts,
        foods: newFoods,
        pheromones: finalPheromones
      }
    })
  }

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [
    simulationState.isRunning, 
    simulationState.speed, 
    simulationState.ants, 
    simulationState.foods, 
    simulationState.pheromones
  ])
}

