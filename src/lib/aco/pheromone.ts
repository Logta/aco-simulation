import type { Position, Pheromone } from './types'

export const createPheromoneKey = (position: Position): string => 
  `${Math.floor(position.x / 10)},${Math.floor(position.y / 10)}`

export const depositPheromone = (
  pheromones: Map<string, Pheromone>,
  position: Position,
  type: 'toFood' | 'toNest',
  amount: number
): Map<string, Pheromone> => {
  const key = createPheromoneKey(position)
  const existing = pheromones.get(key)
  
  const newPheromone: Pheromone = existing
    ? {
        ...existing,
        intensity: Math.min(100, existing.intensity + amount),
      }
    : {
        position: {
          x: Math.floor(position.x / 10) * 10 + 5,
          y: Math.floor(position.y / 10) * 10 + 5,
        },
        intensity: amount,
        type,
      }
  
  const newMap = new Map(pheromones)
  newMap.set(key, newPheromone)
  return newMap
}

export const decayPheromones = (
  pheromones: Map<string, Pheromone>,
  decayRate: number
): Map<string, Pheromone> => {
  const newMap = new Map<string, Pheromone>()
  
  pheromones.forEach((pheromone, key) => {
    const decayedIntensity = pheromone.intensity * decayRate
    if (decayedIntensity > 0.01) {
      newMap.set(key, {
        ...pheromone,
        intensity: decayedIntensity,
      })
    }
  })
  
  return newMap
}

export const getPheromoneStrength = (
  pheromones: Map<string, Pheromone>,
  position: Position,
  type: 'toFood' | 'toNest'
): number => {
  let totalStrength = 0
  
  pheromones.forEach((pheromone) => {
    if (pheromone.type === type) {
      const dx = position.x - pheromone.position.x
      const dy = position.y - pheromone.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < 30) {
        totalStrength += pheromone.intensity / (1 + distance)
      }
    }
  })
  
  return totalStrength
}