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

export const moveWithBias = (
  position: Position,
  direction: number,
  target: Position,
  worldWidth: number,
  worldHeight: number,
  biasStrength: number = 0.3,
  speed: number = 2
): { position: Position; direction: number } => {
  // 目標への方向を計算
  const dx = target.x - position.x
  const dy = target.y - position.y
  
  const wrappedDx = dx > worldWidth / 2 ? dx - worldWidth :
                    dx < -worldWidth / 2 ? dx + worldWidth : dx
  const wrappedDy = dy > worldHeight / 2 ? dy - worldHeight :
                    dy < -worldHeight / 2 ? dy + worldHeight : dy
  
  const targetDirection = Math.atan2(wrappedDy, wrappedDx)
  
  // ランダムウォークを追加
  const randomTurn = (Math.random() - 0.5) * 0.8
  
  // 現在の方向、目標方向、ランダムウォークをブレンド
  const directionToTarget = targetDirection - direction
  let adjustedDirectionToTarget = directionToTarget
  
  // 角度差を正規化
  if (adjustedDirectionToTarget > Math.PI) {
    adjustedDirectionToTarget -= 2 * Math.PI
  } else if (adjustedDirectionToTarget < -Math.PI) {
    adjustedDirectionToTarget += 2 * Math.PI
  }
  
  const newDirection = direction + 
    adjustedDirectionToTarget * biasStrength + 
    randomTurn * (1 - biasStrength)

  const newPosition = {
    x: position.x + Math.cos(newDirection) * speed,
    y: position.y + Math.sin(newDirection) * speed,
  }

  return {
    position: torusWrap(newPosition, worldWidth, worldHeight),
    direction: newDirection,
  }
}

export const avoidCollisions = (
  position: Position,
  direction: number,
  otherAnts: Array<{ position: Position; id: string }>,
  currentAntId: string,
  worldWidth: number,
  worldHeight: number,
  avoidanceRadius: number = 8
): { direction: number; position: Position } => {
  const avoidanceForce = { x: 0, y: 0 }
  let collisionCount = 0
  
  otherAnts.forEach(ant => {
    if (ant.id === currentAntId) return
    
    const distance = torusDistance(position, ant.position, worldWidth, worldHeight)
    if (distance < avoidanceRadius && distance > 0) {
      // Calculate avoidance direction (away from other ant)
      const dx = position.x - ant.position.x
      const dy = position.y - ant.position.y
      
      // Handle torus wrapping for avoidance
      const wrappedDx = dx > worldWidth / 2 ? dx - worldWidth :
                        dx < -worldWidth / 2 ? dx + worldWidth : dx
      const wrappedDy = dy > worldHeight / 2 ? dy - worldHeight :
                        dy < -worldHeight / 2 ? dy + worldHeight : dy
      
      // Normalize and weight by distance
      const weight = (avoidanceRadius - distance) / avoidanceRadius
      const length = Math.sqrt(wrappedDx * wrappedDx + wrappedDy * wrappedDy)
      
      if (length > 0) {
        avoidanceForce.x += (wrappedDx / length) * weight
        avoidanceForce.y += (wrappedDy / length) * weight
        collisionCount++
      }
    }
  })
  
  if (collisionCount === 0) {
    return { direction, position }
  }
  
  // Calculate avoidance direction
  const avoidanceDirection = Math.atan2(avoidanceForce.y, avoidanceForce.x)
  
  // Blend current direction with avoidance direction
  const avoidanceStrength = Math.min(collisionCount * 0.5, 1)
  const directionDiff = avoidanceDirection - direction
  
  // 角度差を正規化
  let normalizedDiff = directionDiff
  if (normalizedDiff > Math.PI) {
    normalizedDiff -= 2 * Math.PI
  } else if (normalizedDiff < -Math.PI) {
    normalizedDiff += 2 * Math.PI
  }
  
  const newDirection = direction + normalizedDiff * avoidanceStrength
  
  // Slightly adjust position to avoid getting stuck
  const adjustmentStrength = avoidanceStrength * 0.5
  const newPosition = {
    x: position.x + avoidanceForce.x * adjustmentStrength,
    y: position.y + avoidanceForce.y * adjustmentStrength
  }
  
  return { 
    direction: newDirection, 
    position: torusWrap(newPosition, worldWidth, worldHeight)
  }
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