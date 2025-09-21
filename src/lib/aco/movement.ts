import type { Position } from './types'
import { torusWrap } from './geometry'

/**
 * アリの基本移動パラメータ
 */
export type MovementParams = {
  readonly speed: number
  readonly randomTurnRange: number
}

/**
 * バイアス付き移動のパラメータ
 */
export type BiasedMovementParams = MovementParams & {
  readonly biasStrength: number
}

/**
 * 移動結果
 */
export type MovementResult = {
  readonly position: Position
  readonly direction: number
}

/**
 * アリの基本移動（ランダムウォーク付き）
 * @param position 現在位置
 * @param direction 現在の方向（ラジアン）
 * @param worldWidth 世界の幅
 * @param worldHeight 世界の高さ
 * @param params 移動パラメータ
 * @returns 新しい位置と方向
 */
export const moveAnt = (
  position: Position,
  direction: number,
  worldWidth: number,
  worldHeight: number,
  params: MovementParams = { speed: 2, randomTurnRange: 0.5 }
): MovementResult => {
  // ランダムな方向転換（-0.25 〜 +0.25 ラジアン）
  const randomTurn = (Math.random() - 0.5) * params.randomTurnRange
  const newDirection = direction + randomTurn

  // 新しい位置を計算
  const newPosition = {
    x: position.x + Math.cos(newDirection) * params.speed,
    y: position.y + Math.sin(newDirection) * params.speed,
  }

  return {
    position: torusWrap(newPosition, worldWidth, worldHeight),
    direction: newDirection,
  }
}

/**
 * 目標に向かって移動（完全直線移動）
 * @param position 現在位置
 * @param target 目標位置
 * @param worldWidth 世界の幅
 * @param worldHeight 世界の高さ
 * @param speed 移動速度
 * @returns 新しい位置
 */
export const moveTowardsTarget = (
  position: Position,
  target: Position,
  worldWidth: number,
  worldHeight: number,
  speed: number = 2
): Position => {
  const dx = target.x - position.x
  const dy = target.y - position.y
  
  // トーラス世界での最短経路を計算
  const wrappedDx = dx > worldWidth / 2 ? dx - worldWidth :
                    dx < -worldWidth / 2 ? dx + worldWidth : dx
  const wrappedDy = dy > worldHeight / 2 ? dy - worldHeight :
                    dy < -worldHeight / 2 ? dy + worldHeight : dy
  
  const distance = Math.sqrt(wrappedDx * wrappedDx + wrappedDy * wrappedDy)
  
  // 目標に到達した場合
  if (distance < speed) {
    return target
  }
  
  // 正規化された移動ベクトルを計算
  const moveX = (wrappedDx / distance) * speed
  const moveY = (wrappedDy / distance) * speed
  
  return torusWrap({
    x: position.x + moveX,
    y: position.y + moveY,
  }, worldWidth, worldHeight)
}

/**
 * 目標へのバイアス付き移動（自然な動き）
 * @param position 現在位置
 * @param direction 現在の方向
 * @param target 目標位置
 * @param worldWidth 世界の幅
 * @param worldHeight 世界の高さ
 * @param params バイアス付き移動パラメータ
 * @returns 新しい位置と方向
 */
export const moveWithBias = (
  position: Position,
  direction: number,
  target: Position,
  worldWidth: number,
  worldHeight: number,
  params: BiasedMovementParams = { 
    speed: 2, 
    randomTurnRange: 0.8, 
    biasStrength: 0.3 
  }
): MovementResult => {
  // 目標への方向を計算
  const dx = target.x - position.x
  const dy = target.y - position.y
  
  // トーラス世界での最短経路の方向を計算
  const wrappedDx = dx > worldWidth / 2 ? dx - worldWidth :
                    dx < -worldWidth / 2 ? dx + worldWidth : dx
  const wrappedDy = dy > worldHeight / 2 ? dy - worldHeight :
                    dy < -worldHeight / 2 ? dy + worldHeight : dy
  
  const targetDirection = Math.atan2(wrappedDy, wrappedDx)
  
  // ランダムウォークを追加
  const randomTurn = (Math.random() - 0.5) * params.randomTurnRange
  
  // 現在の方向、目標方向、ランダムウォークをブレンド
  const directionToTarget = targetDirection - direction
  let adjustedDirectionToTarget = directionToTarget
  
  // 角度差を正規化（-π 〜 π の範囲に収める）
  if (adjustedDirectionToTarget > Math.PI) {
    adjustedDirectionToTarget -= 2 * Math.PI
  } else if (adjustedDirectionToTarget < -Math.PI) {
    adjustedDirectionToTarget += 2 * Math.PI
  }
  
  // 最終的な方向を計算（バイアス強度で重み付け）
  const newDirection = direction + 
    adjustedDirectionToTarget * params.biasStrength + 
    randomTurn * (1 - params.biasStrength)

  // 新しい位置を計算
  const newPosition = {
    x: position.x + Math.cos(newDirection) * params.speed,
    y: position.y + Math.sin(newDirection) * params.speed,
  }

  return {
    position: torusWrap(newPosition, worldWidth, worldHeight),
    direction: newDirection,
  }
}