import type { Position } from './types'
import { torusDistance, torusWrap, normalizeAngle } from './geometry'

/**
 * 衝突回避のパラメータ
 */
export type CollisionParams = {
  readonly avoidanceRadius: number
  readonly avoidanceStrength: number
}

/**
 * 衝突回避の結果
 */
export type CollisionResult = {
  readonly direction: number
  readonly position: Position
}

/**
 * 他のアリとの衝突を回避する
 * 指定された回避半径内にいる他のアリから離れる方向に移動を調整
 * @param position 現在位置
 * @param direction 現在の方向
 * @param otherAnts 他のアリの位置情報
 * @param currentAntId 現在のアリのID
 * @param worldWidth 世界の幅
 * @param worldHeight 世界の高さ
 * @param params 衝突回避パラメータ
 * @returns 調整された方向と位置
 */
export const avoidCollisions = (
  position: Position,
  direction: number,
  otherAnts: Array<{ position: Position; id: string }>,
  currentAntId: string,
  worldWidth: number,
  worldHeight: number,
  params: CollisionParams = { 
    avoidanceRadius: 8, 
    avoidanceStrength: 0.5 
  }
): CollisionResult => {
  // 回避力を蓄積
  const avoidanceForce = { x: 0, y: 0 }
  let collisionCount = 0
  
  // 他のアリとの距離をチェック
  otherAnts.forEach(ant => {
    if (ant.id === currentAntId) return
    
    const distance = torusDistance(position, ant.position, worldWidth, worldHeight)
    
    // 回避半径内にいる場合
    if (distance < params.avoidanceRadius && distance > 0) {
      // 他のアリから離れる方向を計算
      const dx = position.x - ant.position.x
      const dy = position.y - ant.position.y
      
      // トーラス世界での適切な回避方向を計算
      const wrappedDx = dx > worldWidth / 2 ? dx - worldWidth :
                        dx < -worldWidth / 2 ? dx + worldWidth : dx
      const wrappedDy = dy > worldHeight / 2 ? dy - worldHeight :
                        dy < -worldHeight / 2 ? dy + worldHeight : dy
      
      // 距離による重み付け（近いほど強い回避力）
      const weight = (params.avoidanceRadius - distance) / params.avoidanceRadius
      const length = Math.sqrt(wrappedDx * wrappedDx + wrappedDy * wrappedDy)
      
      // 正規化された回避ベクトルを蓄積
      if (length > 0) {
        avoidanceForce.x += (wrappedDx / length) * weight
        avoidanceForce.y += (wrappedDy / length) * weight
        collisionCount++
      }
    }
  })
  
  // 衝突の危険がない場合は元の方向と位置を返す
  if (collisionCount === 0) {
    return { direction, position }
  }
  
  // 回避方向を計算
  const avoidanceDirection = Math.atan2(avoidanceForce.y, avoidanceForce.x)
  
  // 現在の方向と回避方向をブレンド
  const finalAvoidanceStrength = Math.min(collisionCount * params.avoidanceStrength, 1)
  const directionDiff = normalizeAngle(avoidanceDirection - direction)
  
  const newDirection = direction + directionDiff * finalAvoidanceStrength
  
  // 位置も微調整して重複を避ける
  const adjustmentStrength = finalAvoidanceStrength * 0.5
  const newPosition = {
    x: position.x + avoidanceForce.x * adjustmentStrength,
    y: position.y + avoidanceForce.y * adjustmentStrength
  }
  
  return { 
    direction: newDirection, 
    position: torusWrap(newPosition, worldWidth, worldHeight)
  }
}