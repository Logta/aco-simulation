import { useEffect, useRef } from 'react'
import { useSimulationStore } from '@/stores/simulation.store'
import { moveAnt, moveTowardsTarget, moveWithBias, followPheromone, avoidCollisions, torusDistance } from '@/lib/aco/ant'
import { depositPheromone, decayPheromones } from '@/lib/aco/pheromone'
import type { Ant, Food, Pheromone } from '@/lib/aco/types'

export const useSimulation = () => {
  const animationFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const lastDecayTimeRef = useRef<number>(0)
  
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
    pheromoneTrackingStrength,
  } = useSimulationStore()

  const animate = (currentTime: number) => {
    if (!isRunning) {
      lastTimeRef.current = currentTime
      animationFrameRef.current = requestAnimationFrame(animate)
      return
    }

    const deltaTime = currentTime - lastTimeRef.current
    
    if (deltaTime > 50 / speed) {
      // Batch ant updates
      const antUpdates: Array<{ id: string; updates: Partial<Ant> }> = []
      const pheromoneUpdates = new Map<string, Pheromone>()
      const foodUpdates: Array<{ id: string; updates: Partial<Food> }> = []
      const foodsToRemove: string[] = []
      
      ants.forEach(ant => {

        if (ant.hasFood) {
          const distanceToNest = torusDistance(ant.position, nest, worldWidth, worldHeight)
          
          if (distanceToNest < 10) {
            // Arrived at nest - drop food
            antUpdates.push({ id: ant.id, updates: { hasFood: false, targetFood: null, foodAmount: null } })
          } else {
            // Move directly towards nest when carrying food
            const newPosition = moveTowardsTarget(
              ant.position,
              nest,
              worldWidth,
              worldHeight,
              2
            )
            
            // Calculate direction to nest for proper orientation
            const dx = nest.x - ant.position.x
            const dy = nest.y - ant.position.y
            const wrappedDx = dx > worldWidth / 2 ? dx - worldWidth :
                              dx < -worldWidth / 2 ? dx + worldWidth : dx
            const wrappedDy = dy > worldHeight / 2 ? dy - worldHeight :
                              dy < -worldHeight / 2 ? dy + worldHeight : dy
            let newDirection = Math.atan2(wrappedDy, wrappedDx)
            
            // Apply collision avoidance
            const avoidanceResult = avoidCollisions(
              newPosition,
              newDirection,
              ants,
              ant.id,
              worldWidth,
              worldHeight,
              6
            )
            newDirection = avoidanceResult.direction
            
            antUpdates.push({ id: ant.id, updates: { position: newPosition, direction: newDirection } })
            
            // Deposit pheromone while carrying food (constant rate based on food value)
            // Realistic: ants deposit continuously while returning, amount depends on food quality
            const foodQualityMultiplier = ant.foodAmount ? 1 + Math.min(ant.foodAmount / 30, 2) : 1
            const newPheromones = depositPheromone(
              pheromones,
              ant.position,
              'toFood',
              pheromoneDepositAmount * foodQualityMultiplier
            )
            newPheromones.forEach((pheromone, key) => {
              pheromoneUpdates.set(key, pheromone)
            })
          }
        } else {
          // Check if ant can see nearby food (within detection range)
          const detectionRange = 20
          const nearbyFood = foods.find(food => {
            const distance = torusDistance(ant.position, food.position, worldWidth, worldHeight)
            return distance <= detectionRange
          })
          
          if (nearbyFood) {
            const distanceToFood = torusDistance(ant.position, nearbyFood.position, worldWidth, worldHeight)
            
            if (distanceToFood < 10) {
              // Collect food
              antUpdates.push({ id: ant.id, updates: { hasFood: true, targetFood: nearbyFood.id, foodAmount: nearbyFood.amount } })
              
              const updatedFood = foods.find(f => f.id === nearbyFood.id)
              if (updatedFood) {
                const newAmount = updatedFood.amount - 1
                if (newAmount <= 0) {
                  foodsToRemove.push(nearbyFood.id)
                } else {
                  foodUpdates.push({ id: nearbyFood.id, updates: { amount: newAmount } })
                }
              }
              
              // Realistic: No pheromone when just finding food
              // Ants only deposit on the way back
            } else {
              // Move towards nearby food with some randomness
              const { position, direction: tempDirection } = moveWithBias(
                ant.position,
                ant.direction,
                nearbyFood.position,
                worldWidth,
                worldHeight,
                0.4,
                2
              )
              
              // Apply collision avoidance
              const avoidanceResult = avoidCollisions(
                position,
                tempDirection,
                ants,
                ant.id,
                worldWidth,
                worldHeight
              )
              const direction = avoidanceResult.direction
              const finalPosition = avoidanceResult.position
              
              antUpdates.push({ id: ant.id, updates: { position: finalPosition, direction } })
              
              // Realistic: No pheromone when just searching
            }
          } else {
            // No food nearby - follow pheromones or random walk
            const newDirection = followPheromone(
              ant.position,
              pheromones,
              'toFood',
              ant.direction,
              worldWidth,
              worldHeight
            )
            
            const shouldFollowPheromone = Math.random() < pheromoneTrackingStrength && pheromones.size > 0
            
            // Check if pheromone direction is significantly different from current direction
            const directionDiff = Math.abs(newDirection - ant.direction)
            const normalizedDiff = Math.min(directionDiff, 2 * Math.PI - directionDiff)
            const hasValidPheromone = normalizedDiff > 0.1 // Only follow if direction change is meaningful
            
            const { position, direction: tempDirection } = shouldFollowPheromone && hasValidPheromone
              ? moveAnt(ant.position, newDirection, worldWidth, worldHeight, 2)
              : moveAnt(ant.position, ant.direction, worldWidth, worldHeight, 2)
            
            // Apply collision avoidance
            const avoidanceResult = avoidCollisions(
              position,
              tempDirection,
              ants,
              ant.id,
              worldWidth,
              worldHeight
            )
            const direction = avoidanceResult.direction
            const finalPosition = avoidanceResult.position
            
            antUpdates.push({ id: ant.id, updates: { position: finalPosition, direction } })
            
            // Realistic: No pheromone while exploring
          }
        }
      })
      
      // Apply batch updates
      useSimulationStore.setState((state) => {
        const newAnts = state.ants.map(ant => {
          const update = antUpdates.find(u => u.id === ant.id)
          return update ? { ...ant, ...update.updates } : ant
        })
        
        let newFoods = state.foods
        if (foodUpdates.length > 0 || foodsToRemove.length > 0) {
          newFoods = state.foods
            .filter(f => !foodsToRemove.includes(f.id))
            .map(food => {
              const update = foodUpdates.find(u => u.id === food.id)
              return update ? { ...food, ...update.updates } : food
            })
        }
        
        const newPheromones = new Map(state.pheromones)
        pheromoneUpdates.forEach((pheromone, key) => {
          newPheromones.set(key, pheromone)
        })
        
        // Decay pheromones only every 500ms (not every frame)
        let finalPheromones = newPheromones
        if (currentTime - lastDecayTimeRef.current > 500) {
          finalPheromones = decayPheromones(newPheromones, pheromoneDecayRate)
          lastDecayTimeRef.current = currentTime
        }
        
        return {
          ants: newAnts,
          foods: newFoods,
          pheromones: finalPheromones
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