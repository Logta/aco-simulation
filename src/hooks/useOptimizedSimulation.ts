import { useEffect, useRef, useCallback } from 'react'
import { useSimulationStore } from '@/stores/simulation.store'
import { moveAnt, moveTowardsTarget, followPheromone, torusDistance } from '@/lib/aco/ant'
import { depositPheromone } from '@/lib/aco/pheromone'
import type { Ant, Food } from '@/lib/aco/types'

export const useOptimizedSimulation = () => {
  const animationFrameRef = useRef<number>()
  const lastTimeRef = useRef<number>(0)
  const batchUpdatesRef = useRef<Map<string, Partial<Ant>>>(new Map())
  const pheromoneUpdatesRef = useRef<Map<string, any>>(new Map())
  
  const store = useSimulationStore()
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
  } = store

  // Spatial indexing for performance
  const spatialIndex = useRef<Map<string, Food[]>>(new Map())
  
  const updateSpatialIndex = useCallback(() => {
    spatialIndex.current.clear()
    const cellSize = 50
    
    foods.forEach(food => {
      const cellX = Math.floor(food.position.x / cellSize)
      const cellY = Math.floor(food.position.y / cellSize)
      const key = `${cellX},${cellY}`
      
      if (!spatialIndex.current.has(key)) {
        spatialIndex.current.set(key, [])
      }
      spatialIndex.current.get(key)!.push(food)
    })
  }, [foods])

  const findNearestFood = useCallback((ant: Ant): Food | null => {
    const cellSize = 50
    const cellX = Math.floor(ant.position.x / cellSize)
    const cellY = Math.floor(ant.position.y / cellSize)
    
    let nearest: Food | null = null
    let nearestDistance = Infinity
    
    // Check surrounding cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`
        const cellFoods = spatialIndex.current.get(key) || []
        
        cellFoods.forEach(food => {
          const distance = torusDistance(ant.position, food.position, worldWidth, worldHeight)
          if (distance < nearestDistance) {
            nearest = food
            nearestDistance = distance
          }
        })
      }
    }
    
    return nearest
  }, [worldWidth, worldHeight])

  const updateAntBehavior = useCallback((ant: Ant) => {
    const nearestFood = findNearestFood(ant)
    const updates: Partial<Ant> = {}

    if (ant.hasFood) {
      const distanceToNest = torusDistance(ant.position, nest, worldWidth, worldHeight)
      
      if (distanceToNest < 10) {
        updates.hasFood = false
        updates.targetFood = null
        
        const newPheromones = depositPheromone(
          pheromones,
          ant.position,
          'toNest',
          pheromoneDepositAmount * 5
        )
        newPheromones.forEach((pheromone, key) => {
          pheromoneUpdatesRef.current.set(key, pheromone)
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
        
        updates.position = newPosition
        updates.direction = newDirection
        
        const newPheromones = depositPheromone(
          pheromones,
          ant.position,
          'toFood',
          pheromoneDepositAmount
        )
        newPheromones.forEach((pheromone, key) => {
          pheromoneUpdatesRef.current.set(key, pheromone)
        })
      }
    } else {
      if (nearestFood) {
        const distanceToFood = torusDistance(ant.position, nearestFood.position, worldWidth, worldHeight)
        
        if (distanceToFood < 10) {
          updates.hasFood = true
          updates.targetFood = nearestFood.id
          
          // Queue food update or removal
          const updatedFood = foods.find(f => f.id === nearestFood.id)
          if (updatedFood) {
            const newAmount = updatedFood.amount - 1
            if (newAmount <= 0) {
              setTimeout(() => store.removeFood(nearestFood.id), 0)
            } else {
              setTimeout(() => store.updateFood(nearestFood.id, { amount: newAmount }), 0)
            }
          }
          
          const newPheromones = depositPheromone(
            pheromones,
            ant.position,
            'toFood',
            pheromoneDepositAmount * 5
          )
          newPheromones.forEach((pheromone, key) => {
            pheromoneUpdatesRef.current.set(key, pheromone)
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
          
          updates.position = position
          updates.direction = direction
          
          if (Math.random() < 0.3) { // Reduce pheromone deposit frequency
            const newPheromones = depositPheromone(
              pheromones,
              ant.position,
              'toNest',
              pheromoneDepositAmount * 0.3
            )
            newPheromones.forEach((pheromone, key) => {
              pheromoneUpdatesRef.current.set(key, pheromone)
            })
          }
        }
      } else {
        const { position, direction } = moveAnt(
          ant.position,
          ant.direction,
          worldWidth,
          worldHeight,
          2
        )
        updates.position = position
        updates.direction = direction
      }
    }
    
    batchUpdatesRef.current.set(ant.id, updates)
  }, [findNearestFood, nest, worldWidth, worldHeight, pheromones, pheromoneDepositAmount, foods, store])

  const animate = useCallback((currentTime: number) => {
    if (!isRunning) {
      lastTimeRef.current = currentTime
      animationFrameRef.current = requestAnimationFrame(animate)
      return
    }

    const deltaTime = currentTime - lastTimeRef.current
    
    if (deltaTime > 50 / speed) {
      updateSpatialIndex()
      
      // Process ants in batches
      const batchSize = Math.min(10, ants.length)
      const startIndex = (Math.floor(currentTime / 100) * batchSize) % ants.length
      const endIndex = Math.min(startIndex + batchSize, ants.length)
      
      for (let i = startIndex; i < endIndex; i++) {
        updateAntBehavior(ants[i])
      }
      
      // Apply batched updates
      if (batchUpdatesRef.current.size > 0) {
        batchUpdatesRef.current.forEach((updates, id) => {
          store.updateAnt(id, updates)
        })
        batchUpdatesRef.current.clear()
      }
      
      // Apply pheromone updates
      if (pheromoneUpdatesRef.current.size > 0) {
        pheromoneUpdatesRef.current.forEach((pheromone, key) => {
          store.updatePheromone(key, pheromone)
        })
        pheromoneUpdatesRef.current.clear()
      }
      
      // Decay pheromones less frequently
      if (Math.floor(currentTime / 200) % 5 === 0) {
        store.decayPheromones()
      }
      
      lastTimeRef.current = currentTime
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [isRunning, speed, ants, updateSpatialIndex, updateAntBehavior, store])

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [animate])
}