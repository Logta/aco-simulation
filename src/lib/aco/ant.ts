/**
 * アリの移動と行動に関する関数
 * 各機能は専用モジュールに分割されており、このファイルは統合インターフェースを提供
 */

// 各専門モジュールから関数をエクスポート
export {
  moveAnt,
  moveTowardsTarget,
  moveWithBias,
  type MovementParams,
  type BiasedMovementParams,
  type MovementResult,
} from './movement'

export {
  torusWrap,
  torusDistance,
  normalizeAngle,
} from './geometry'

export {
  avoidCollisions,
  type CollisionParams,
  type CollisionResult,
} from './collision'

export {
  followPheromone,
  findNearestTarget,
  getTargetsInRadius,
  type PheromoneTrackingParams,
} from './pathfinding'

// 定数もエクスポート
export {
  SIMULATION_CONSTANTS,
  ANT_CONSTANTS,
  PHEROMONE_CONSTANTS,
  UI_CONSTANTS,
  DEBUG_CONSTANTS,
} from './constants'