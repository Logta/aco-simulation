import type { Ant, Food, Position, Pheromone } from './types'
import { torusDistance, moveTowardsTarget, moveWithBias, moveAnt, followPheromone, avoidCollisions } from './ant'
import { depositPheromone } from './pheromone'

type AntBehaviorContext = {
  ant: Ant
  foods: Food[]
  pheromones: Map<string, Pheromone>
  nest: Position
  worldWidth: number
  worldHeight: number
  pheromoneDepositAmount: number
  pheromoneTrackingStrength: number
  ants: Ant[]
}

type AntBehaviorResult = {
  antUpdate?: Partial<Ant>
  pheromoneUpdates: Map<string, Pheromone>
  foodUpdate?: { id: string; amount: number }
  removeFood?: string
}

// Constants
const FOOD_DETECTION_RANGE = 20
const FOOD_COLLECTION_RANGE = 10
const NEST_ARRIVAL_RANGE = 10
const COLLISION_AVOIDANCE_RADIUS = 6
const ANT_SPEED = 2
const FOOD_APPROACH_BIAS = 0.4

/**
 * Execute ant behavior based on its current state
 */
export const executeAntBehavior = (context: AntBehaviorContext): AntBehaviorResult => {
  const { ant } = context
  
  if (ant.hasFood) {
    return executeReturningBehavior(context)
  } else {
    return executeForagingBehavior(context)
  }
}

const executeReturningBehavior = (context: AntBehaviorContext): AntBehaviorResult => {
  const { ant, nest, worldWidth, worldHeight, pheromoneDepositAmount, pheromones } = context
  const distanceToNest = torusDistance(ant.position, nest, worldWidth, worldHeight)
  
  if (distanceToNest < NEST_ARRIVAL_RANGE) {
    // Arrived at nest - deliver food
    return {
      antUpdate: { hasFood: false, targetFood: null, foodAmount: null },
      pheromoneUpdates: new Map()
    }
  }

  // Move towards nest
  const movement = moveTowardsNest(context)
  
  // Deposit pheromone trail back to food source
  const foodQualityMultiplier = calculateFoodQualityMultiplier(ant.foodAmount)
  const newPheromones = depositPheromone(
    pheromones,
    ant.position,
    'toFood',
    pheromoneDepositAmount * foodQualityMultiplier
  )

  return {
    antUpdate: movement,
    pheromoneUpdates: newPheromones
  }
}

const executeForagingBehavior = (context: AntBehaviorContext): AntBehaviorResult => {
  const nearbyFood = detectNearbyFood(context)
  
  if (nearbyFood) {
    return handleFoodInteraction(context, nearbyFood)
  } else {
    return executeExploration(context)
  }
}

const detectNearbyFood = (context: AntBehaviorContext): Food | undefined => {
  const { ant, foods, worldWidth, worldHeight } = context
  
  return foods.find(food => {
    const distance = torusDistance(ant.position, food.position, worldWidth, worldHeight)
    return distance <= FOOD_DETECTION_RANGE
  })
}

const handleFoodInteraction = (context: AntBehaviorContext, food: Food): AntBehaviorResult => {
  const { ant, worldWidth, worldHeight } = context
  const distanceToFood = torusDistance(ant.position, food.position, worldWidth, worldHeight)
  
  if (distanceToFood < FOOD_COLLECTION_RANGE) {
    // Collect food
    return collectFood(food)
  } else {
    // Approach food
    return approachFood(context, food)
  }
}

const collectFood = (food: Food): AntBehaviorResult => {
  const newAmount = food.amount - 1
  
  return {
    antUpdate: { 
      hasFood: true, 
      targetFood: food.id, 
      foodAmount: food.amount 
    },
    pheromoneUpdates: new Map(),
    foodUpdate: newAmount > 0 ? { id: food.id, amount: newAmount } : undefined,
    removeFood: newAmount <= 0 ? food.id : undefined
  }
}

const approachFood = (context: AntBehaviorContext, food: Food): AntBehaviorResult => {
  const { ant, worldWidth, worldHeight, ants } = context
  
  const { position, direction: tempDirection } = moveWithBias(
    ant.position,
    ant.direction,
    food.position,
    worldWidth,
    worldHeight,
    FOOD_APPROACH_BIAS,
    ANT_SPEED
  )
  
  const avoidanceResult = avoidCollisions(
    position,
    tempDirection,
    ants,
    ant.id,
    worldWidth,
    worldHeight
  )
  
  return {
    antUpdate: { 
      position: avoidanceResult.position, 
      direction: avoidanceResult.direction 
    },
    pheromoneUpdates: new Map()
  }
}

const executeExploration = (context: AntBehaviorContext): AntBehaviorResult => {
  const { ant, pheromones, worldWidth, worldHeight, ants } = context
  
  // Try to follow pheromone trails
  const pheromoneDirection = followPheromone(
    ant.position,
    pheromones,
    'toFood',
    ant.direction,
    worldWidth,
    worldHeight
  )
  
  const shouldFollow = shouldFollowPheromone(context, pheromoneDirection)
  
  const { position, direction: tempDirection } = shouldFollow
    ? moveAnt(ant.position, pheromoneDirection, worldWidth, worldHeight, ANT_SPEED)
    : moveAnt(ant.position, ant.direction, worldWidth, worldHeight, ANT_SPEED)
  
  const avoidanceResult = avoidCollisions(
    position,
    tempDirection,
    ants,
    ant.id,
    worldWidth,
    worldHeight
  )
  
  return {
    antUpdate: { 
      position: avoidanceResult.position, 
      direction: avoidanceResult.direction 
    },
    pheromoneUpdates: new Map()
  }
}

const moveTowardsNest = (context: AntBehaviorContext): Partial<Ant> => {
  const { ant, nest, worldWidth, worldHeight, ants } = context
  
  const newPosition = moveTowardsTarget(
    ant.position,
    nest,
    worldWidth,
    worldHeight,
    ANT_SPEED
  )
  
  // Calculate proper orientation
  const dx = nest.x - ant.position.x
  const dy = nest.y - ant.position.y
  const wrappedDx = dx > worldWidth / 2 ? dx - worldWidth :
                    dx < -worldWidth / 2 ? dx + worldWidth : dx
  const wrappedDy = dy > worldHeight / 2 ? dy - worldHeight :
                    dy < -worldHeight / 2 ? dy + worldHeight : dy
  let newDirection = Math.atan2(wrappedDy, wrappedDx)
  
  const avoidanceResult = avoidCollisions(
    newPosition,
    newDirection,
    ants,
    ant.id,
    worldWidth,
    worldHeight,
    COLLISION_AVOIDANCE_RADIUS
  )
  
  return { 
    position: avoidanceResult.position, 
    direction: avoidanceResult.direction 
  }
}

const shouldFollowPheromone = (context: AntBehaviorContext, pheromoneDirection: number): boolean => {
  const { ant, pheromones, pheromoneTrackingStrength } = context
  
  if (pheromones.size === 0) return false
  if (Math.random() >= pheromoneTrackingStrength) return false
  
  // Check if pheromone direction is significantly different from current direction
  const directionDiff = Math.abs(pheromoneDirection - ant.direction)
  const normalizedDiff = Math.min(directionDiff, 2 * Math.PI - directionDiff)
  
  return normalizedDiff > 0.1
}

const calculateFoodQualityMultiplier = (foodAmount: number | null): number => {
  if (!foodAmount) return 1
  // Scale multiplier between 1x and 3x based on food amount
  return 1 + Math.min(foodAmount / 30, 2)
}