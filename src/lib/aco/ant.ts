import type { Position } from './types'

export const torusWrap = (position: Position, worldWidth: number, worldHeight: number): Position => ({
  x: ((position.x % worldWidth) + worldWidth) % worldWidth,
  y: ((position.y % worldHeight) + worldHeight) % worldHeight,
})

export const torusDistance = (a: Position, b: Position, worldWidth: number, worldHeight: number): number => {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  
  const wrappedDx = Math.min(dx, worldWidth - dx)
  const wrappedDy = Math.min(dy, worldHeight - dy)
  
  return Math.sqrt(wrappedDx * wrappedDx + wrappedDy * wrappedDy)
}

export const moveAnt = (
  position: Position,
  direction: number,
  worldWidth: number,
  worldHeight: number,
  speed: number = 2
): { position: Position; direction: number } => {
  const randomTurn = (Math.random() - 0.5) * 0.5
  const newDirection = direction + randomTurn

  const newPosition = {
    x: position.x + Math.cos(newDirection) * speed,
    y: position.y + Math.sin(newDirection) * speed,
  }

  return {
    position: torusWrap(newPosition, worldWidth, worldHeight),
    direction: newDirection,
  }
}

export const moveTowardsTarget = (
  position: Position,
  target: Position,
  worldWidth: number,
  worldHeight: number,
  speed: number = 2
): Position => {
  const dx = target.x - position.x
  const dy = target.y - position.y
  
  const wrappedDx = dx > worldWidth / 2 ? dx - worldWidth :
                    dx < -worldWidth / 2 ? dx + worldWidth : dx
  const wrappedDy = dy > worldHeight / 2 ? dy - worldHeight :
                    dy < -worldHeight / 2 ? dy + worldHeight : dy
  
  const distance = Math.sqrt(wrappedDx * wrappedDx + wrappedDy * wrappedDy)
  
  if (distance < speed) {
    return target
  }
  
  const moveX = (wrappedDx / distance) * speed
  const moveY = (wrappedDy / distance) * speed
  
  return torusWrap({
    x: position.x + moveX,
    y: position.y + moveY,
  }, worldWidth, worldHeight)
}

export const followPheromone = (
  position: Position,
  pheromones: Map<string, { position: Position; intensity: number; type: string }>,
  targetType: 'toFood' | 'toNest',
  direction: number,
  worldWidth: number,
  worldHeight: number
): number => {
  const sensorDistance = 20
  const sensorAngle = Math.PI / 4
  
  const sensors = [
    direction - sensorAngle,
    direction,
    direction + sensorAngle,
  ]
  
  const sensorStrengths = sensors.map((angle) => {
    const sensorPos = {
      x: position.x + Math.cos(angle) * sensorDistance,
      y: position.y + Math.sin(angle) * sensorDistance,
    }
    
    let totalStrength = 0
    pheromones.forEach((pheromone) => {
      if (pheromone.type === targetType) {
        const distance = torusDistance(sensorPos, pheromone.position, worldWidth, worldHeight)
        if (distance < 30) {
          totalStrength += pheromone.intensity / (1 + distance)
        }
      }
    })
    
    return totalStrength
  })
  
  const maxIndex = sensorStrengths.indexOf(Math.max(...sensorStrengths))
  
  if (sensorStrengths[maxIndex] > 0.1) {
    return sensors[maxIndex]
  }
  
  return direction
}