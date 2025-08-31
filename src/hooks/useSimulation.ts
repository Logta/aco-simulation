import { useEffect, useRef } from 'react'
import { useSimulationStore } from '@/stores/simulation.store'
import { moveAnt, moveTowardsTarget, followPheromone, torusDistance } from '@/lib/aco/ant'
import { depositPheromone, decayPheromones } from '@/lib/aco/pheromone'
import type { Ant, Food } from '@/lib/aco/types'

export const useSimulation = () => {
  const animationFrameRef = useRef<number>()
  const lastTimeRef = useRef<number>(0)
  
  const {
    isRunning,
    speed,
    ants,
    foods,
    pheromones,
    nest,
    worldWidth,
    worldHeight,
    pheromoneDecayRate,
    pheromoneDepositAmount,
    updateAnt,
    updatePheromone,
    removeFood,
    updateFood,
  } = useSimulationStore()

  const updateAntBehavior = (ant: Ant) => {
    const nearestFood = foods.reduce<Food | null>((nearest, food) => {
      const distance = torusDistance(ant.position, food.position, worldWidth, worldHeight)
      if (!nearest) return food
      const nearestDistance = torusDistance(ant.position, nearest.position, worldWidth, worldHeight)
      return distance < nearestDistance ? food : nearest
    }, null)

    if (ant.hasFood) {
      const distanceToNest = torusDistance(ant.position, nest, worldWidth, worldHeight)
      
      if (distanceToNest < 10) {
        updateAnt(ant.id, { hasFood: false, targetFood: null })
        
        const newPheromones = depositPheromone(
          pheromones,
          ant.position,
          'toNest',
          pheromoneDepositAmount * 5
        )
        newPheromones.forEach((pheromone, key) => {
          updatePheromone(key, pheromone)
        })
      } else {
        const newDirection = followPheromone(
          ant.position,
          pheromones,
          'toNest',
          ant.direction,
          worldWidth,
          worldHeight
        )
        
        const newPosition = moveTowardsTarget(
          ant.position,
          nest,
          worldWidth,
          worldHeight,
          2
        )
        
        updateAnt(ant.id, { position: newPosition, direction: newDirection })
        
        const newPheromones = depositPheromone(
          pheromones,
          ant.position,
          'toFood',
          pheromoneDepositAmount
        )
        newPheromones.forEach((pheromone, key) => {
          updatePheromone(key, pheromone)
        })
      }
    } else {
      if (nearestFood) {
        const distanceToFood = torusDistance(ant.position, nearestFood.position, worldWidth, worldHeight)
        
        if (distanceToFood < 10) {
          updateAnt(ant.id, { hasFood: true, targetFood: nearestFood.id })
          
          const updatedFood = foods.find(f => f.id === nearestFood.id)
          if (updatedFood) {
            const newAmount = updatedFood.amount - 1
            if (newAmount <= 0) {
              removeFood(nearestFood.id)
            } else {
              updateFood(nearestFood.id, { amount: newAmount })
            }
          }
          
          const newPheromones = depositPheromone(
            pheromones,
            ant.position,
            'toFood',
            pheromoneDepositAmount * 5
          )
          newPheromones.forEach((pheromone, key) => {
            updatePheromone(key, pheromone)
          })
        } else {
          const newDirection = followPheromone(
            ant.position,
            pheromones,
            'toFood',
            ant.direction,
            worldWidth,
            worldHeight
          )
          
          const shouldFollowPheromone = Math.random() < 0.7
          const { position, direction } = shouldFollowPheromone && pheromones.size > 0
            ? {
                position: moveTowardsTarget(
                  ant.position,
                  nearestFood.position,
                  worldWidth,
                  worldHeight,
                  2
                ),
                direction: newDirection,
              }
            : moveAnt(ant.position, ant.direction, worldWidth, worldHeight, 2)
          
          updateAnt(ant.id, { position, direction })
          
          const newPheromones = depositPheromone(
            pheromones,
            ant.position,
            'toNest',
            pheromoneDepositAmount * 0.5
          )
          newPheromones.forEach((pheromone, key) => {
            updatePheromone(key, pheromone)
          })
        }
      } else {
        const { position, direction } = moveAnt(
          ant.position,
          ant.direction,
          worldWidth,
          worldHeight,
          2
        )
        updateAnt(ant.id, { position, direction })
      }
    }
  }

  const animate = (currentTime: number) => {
    if (!isRunning) {
      lastTimeRef.current = currentTime
      animationFrameRef.current = requestAnimationFrame(animate)
      return
    }

    const deltaTime = currentTime - lastTimeRef.current
    
    if (deltaTime > 50 / speed) {
      ants.forEach(updateAntBehavior)
      
      const decayedPheromones = decayPheromones(pheromones, pheromoneDecayRate)
      decayedPheromones.forEach((pheromone, key) => {
        if (!pheromones.has(key) || pheromones.get(key)!.intensity !== pheromone.intensity) {
          updatePheromone(key, pheromone)
        }
      })
      
      pheromones.forEach((_, key) => {
        if (!decayedPheromones.has(key)) {
          useSimulationStore.setState((state) => {
            const newPheromones = new Map(state.pheromones)
            newPheromones.delete(key)
            return { pheromones: newPheromones }
          })
        }
      })
      
      lastTimeRef.current = currentTime
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRunning, speed, ants, foods, pheromones])
}