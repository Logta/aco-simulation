import type { Position } from './types'

/**
 * トーラス世界での位置ラッピング
 * 座標が世界の境界を超えた場合、反対側に移動する
 * @param position 元の位置
 * @param worldWidth 世界の幅
 * @param worldHeight 世界の高さ
 * @returns ラップされた位置
 */
export const torusWrap = (
  position: Position, 
  worldWidth: number, 
  worldHeight: number
): Position => ({
  x: ((position.x % worldWidth) + worldWidth) % worldWidth,
  y: ((position.y % worldHeight) + worldHeight) % worldHeight,
})

/**
 * トーラス世界での2点間距離を計算
 * 世界の端で繋がっていることを考慮した最短距離
 * @param a 位置A
 * @param b 位置B
 * @param worldWidth 世界の幅
 * @param worldHeight 世界の高さ
 * @returns 最短距離
 */
export const torusDistance = (
  a: Position, 
  b: Position, 
  worldWidth: number, 
  worldHeight: number
): number => {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  
  // 端を通る距離と直接の距離のうち短い方を選択
  const wrappedDx = Math.min(dx, worldWidth - dx)
  const wrappedDy = Math.min(dy, worldHeight - dy)
  
  return Math.sqrt(wrappedDx * wrappedDx + wrappedDy * wrappedDy)
}

/**
 * 角度を正規化（-π 〜 π の範囲に収める）
 * @param angle 角度（ラジアン）
 * @returns 正規化された角度
 */
export const normalizeAngle = (angle: number): number => {
  let normalized = angle
  while (normalized > Math.PI) {
    normalized -= 2 * Math.PI
  }
  while (normalized < -Math.PI) {
    normalized += 2 * Math.PI
  }
  return normalized
}