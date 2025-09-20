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
    // 対数関数的蒸発モデル
    // 高濃度では多く蒸発し、低濃度では少なく蒸発する
    // これにより、フェロモンが一定の濃度に収束しやすくなる
    
    // 対数関数による蒸発量の計算
    // intensity が高いほど蒸発量が増える
    const logFactor = Math.log10(pheromone.intensity + 1) / Math.log10(101) // 0〜1の範囲に正規化
    
    // decayRateパラメータを蒸発の強さとして使用
    // decayRate = 0.9: 強い蒸発
    // decayRate = 0.999: 弱い蒸発
    const evaporationStrength = (1 - decayRate) * 10 // 0.01〜1.0の範囲
    
    // 対数的な蒸発量（高濃度ほど多く蒸発）
    const logEvaporation = logFactor * evaporationStrength * pheromone.intensity
    
    // 最終的な蒸発計算（基本蒸発 + 対数的蒸発）
    const baseEvaporation = 0.05 // 最小蒸発量
    const totalEvaporation = baseEvaporation + logEvaporation
    
    const decayedIntensity = pheromone.intensity - totalEvaporation
    
    // しきい値
    if (decayedIntensity > 0.1) {
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