import type { Position, Pheromone } from './types'
import { torusDistance } from './geometry'

/**
 * フェロモン追跡のパラメータ
 */
export type PheromoneTrackingParams = {
  readonly sensorDistance: number
  readonly sensorAngle: number
  readonly detectionRadius: number
  readonly minimumStrength: number
}

/**
 * フェロモンを追跡して進行方向を決定
 * 3つのセンサー（左、中央、右）でフェロモン濃度を測定し、
 * 最も濃度が高い方向に進む
 * @param position 現在位置
 * @param pheromones フェロモンマップ
 * @param targetType 追跡するフェロモンタイプ
 * @param direction 現在の方向
 * @param worldWidth 世界の幅
 * @param worldHeight 世界の高さ
 * @param params フェロモン追跡パラメータ
 * @returns 新しい進行方向（フェロモンが検出されない場合は元の方向）
 */
export const followPheromone = (
  position: Position,
  pheromones: Map<string, Pheromone>,
  targetType: 'toFood' | 'toNest',
  direction: number,
  worldWidth: number,
  worldHeight: number,
  params: PheromoneTrackingParams = {
    sensorDistance: 20,
    sensorAngle: Math.PI / 4,
    detectionRadius: 30,
    minimumStrength: 0.1
  }
): number => {
  // 3つのセンサーの角度を設定（左、中央、右）
  const sensors = [
    direction - params.sensorAngle,  // 左センサー
    direction,                       // 中央センサー
    direction + params.sensorAngle,  // 右センサー
  ]
  
  // 各センサー位置でのフェロモン強度を測定
  const sensorStrengths = sensors.map((angle) => {
    // センサーの位置を計算
    const sensorPos = {
      x: position.x + Math.cos(angle) * params.sensorDistance,
      y: position.y + Math.sin(angle) * params.sensorDistance,
    }
    
    // この位置での総フェロモン強度を計算
    let totalStrength = 0
    pheromones.forEach((pheromone) => {
      // 指定されたタイプのフェロモンのみを考慮
      if (pheromone.type === targetType) {
        const distance = torusDistance(
          sensorPos, 
          pheromone.position, 
          worldWidth, 
          worldHeight
        )
        
        // 検出半径内のフェロモンのみを考慮
        if (distance < params.detectionRadius) {
          // 距離に応じて強度を減衰（近いほど強い影響）
          totalStrength += pheromone.intensity / (1 + distance)
        }
      }
    })
    
    return totalStrength
  })
  
  // 最も強いフェロモンを検出したセンサーを特定
  const maxIndex = sensorStrengths.indexOf(Math.max(...sensorStrengths))
  
  // 十分な強度のフェロモンが検出された場合、その方向に進む
  if (sensorStrengths[maxIndex] > params.minimumStrength) {
    return sensors[maxIndex]
  }
  
  // フェロモンが検出されない場合は元の方向を維持
  return direction
}

/**
 * 最も近い目標を見つける
 * @param position 現在位置
 * @param targets 目標のリスト
 * @param worldWidth 世界の幅
 * @param worldHeight 世界の高さ
 * @param maxDistance 最大検索距離（省略時は無制限）
 * @returns 最も近い目標（見つからない場合はnull）
 */
export const findNearestTarget = <T extends { position: Position }>(
  position: Position,
  targets: T[],
  worldWidth: number,
  worldHeight: number,
  maxDistance?: number
): T | null => {
  let nearest: T | null = null
  let minDistance = maxDistance ?? Infinity
  
  targets.forEach(target => {
    const distance = torusDistance(
      position, 
      target.position, 
      worldWidth, 
      worldHeight
    )
    
    if (distance < minDistance) {
      nearest = target
      minDistance = distance
    }
  })
  
  return nearest
}

/**
 * 指定された半径内の目標をすべて取得
 * @param position 中心位置
 * @param targets 目標のリスト
 * @param radius 検索半径
 * @param worldWidth 世界の幅
 * @param worldHeight 世界の高さ
 * @returns 半径内の目標のリスト
 */
export const getTargetsInRadius = <T extends { position: Position }>(
  position: Position,
  targets: T[],
  radius: number,
  worldWidth: number,
  worldHeight: number
): T[] => {
  return targets.filter(target => {
    const distance = torusDistance(
      position, 
      target.position, 
      worldWidth, 
      worldHeight
    )
    return distance <= radius
  })
}