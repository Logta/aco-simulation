/**
 * ACOアルゴリズムの定数定義
 * シミュレーション全体で使用される定数をここに集約
 */

/** シミュレーション関連の定数 */
export const SIMULATION_CONSTANTS = {
  /** フレーム間の遅延（ミリ秒） */
  FRAME_DELAY_MS: 50,
  
  /** フェロモン減衰処理の間隔（ミリ秒） */
  PHEROMONE_DECAY_INTERVAL_MS: 500,
  
  /** デフォルトの世界サイズ */
  DEFAULT_WORLD_WIDTH: 800,
  DEFAULT_WORLD_HEIGHT: 600,
  
  /** デフォルトのネスト位置 */
  DEFAULT_NEST_POSITION: { x: 400, y: 300 },
} as const

/** アリの行動に関する定数 */
export const ANT_CONSTANTS = {
  /** デフォルトの移動速度 */
  DEFAULT_SPEED: 2,
  
  /** ランダム方向転換の範囲（ラジアン） */
  DEFAULT_RANDOM_TURN_RANGE: 0.5,
  
  /** 目標へのバイアス強度（0.0-1.0） */
  DEFAULT_BIAS_STRENGTH: 0.3,
  
  /** 衝突回避半径 */
  DEFAULT_AVOIDANCE_RADIUS: 8,
  
  /** 衝突回避強度 */
  DEFAULT_AVOIDANCE_STRENGTH: 0.5,
  
  /** 食べ物の収集可能距離 */
  FOOD_COLLECTION_DISTANCE: 10,
  
  /** ネストへの到達判定距離 */
  NEST_ARRIVAL_DISTANCE: 15,
} as const

/** フェロモン関連の定数 */
export const PHEROMONE_CONSTANTS = {
  /** フェロモンの最大強度 */
  MAX_INTENSITY: 100,
  
  /** フェロモンの最小強度（これ以下は削除） */
  MIN_INTENSITY_THRESHOLD: 0.1,
  
  /** 基本蒸発量 */
  BASE_EVAPORATION: 0.05,
  
  /** フェロモングリッドのセルサイズ */
  GRID_CELL_SIZE: 10,
  
  /** フェロモンセンサーの距離 */
  SENSOR_DISTANCE: 20,
  
  /** フェロモンセンサーの角度（ラジアン） */
  SENSOR_ANGLE: Math.PI / 4,
  
  /** フェロモン検出半径 */
  DETECTION_RADIUS: 30,
  
  /** フェロモン追跡の最小強度 */
  MIN_TRACKING_STRENGTH: 0.1,
  
  /** デフォルトのフェロモン減衰率 */
  DEFAULT_DECAY_RATE: 0.99,
  
  /** デフォルトのフェロモン放出量 */
  DEFAULT_DEPOSIT_AMOUNT: 2,
  
  /** デフォルトのフェロモン追跡強度 */
  DEFAULT_TRACKING_STRENGTH: 0.7,
} as const

/** UI関連の定数 */
export const UI_CONSTANTS = {
  /** キャンバスの背景色 */
  CANVAS_BACKGROUND_COLOR: '#f0f8ff',
  
  /** アリの色 */
  ANT_COLOR: '#8B4513',
  ANT_COLOR_WITH_FOOD: '#FF6347',
  
  /** 食べ物の色 */
  FOOD_COLOR: '#32CD32',
  
  /** ネストの色 */
  NEST_COLOR: '#D2691E',
  
  /** フェロモンの色 */
  PHEROMONE_TO_FOOD_COLOR: '#4169E1',
  PHEROMONE_TO_NEST_COLOR: '#DC143C',
  
  /** 描画サイズ */
  ANT_RADIUS: 3,
  FOOD_RADIUS: 6,
  NEST_RADIUS: 20,
  PHEROMONE_MIN_RADIUS: 1,
  PHEROMONE_MAX_RADIUS: 8,
} as const

/** デバッグ関連の定数 */
export const DEBUG_CONSTANTS = {
  /** デバッグモードでの追加情報表示 */
  SHOW_ANT_PATHS: false,
  SHOW_SENSOR_LINES: false,
  SHOW_COLLISION_RADIUS: false,
  
  /** ログレベル */
  LOG_LEVEL: 'info' as 'debug' | 'info' | 'warn' | 'error',
} as const