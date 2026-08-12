///|
/// 3つのセンサー(左・中央・右)でフェロモン濃度を測定し、最も濃い方向を返す。
/// 十分な強度が検出されない場合は元の方向を維持する。
pub fn follow_pheromone(
  grid : FixedArray[Double],
  grid_width : Int,
  grid_height : Int,
  position : Position,
  direction : Double,
  world_width : Double,
  world_height : Double,
  sensor_distance : Double,
  sensor_angle : Double,
  detection_radius : Double,
  minimum_strength : Double,
) -> Double {
  let sensors : FixedArray[Double] = [
    direction - sensor_angle, direction, direction + sensor_angle,
  ]
  let mut best_index = 0
  let mut best_strength = -1.0
  for i in 0..<3 {
    let angle = sensors[i]
    let sensor_pos = {
      x: position.x + @math.cos(angle) * sensor_distance,
      y: position.y + @math.sin(angle) * sensor_distance,
    }
    let strength = pheromone_strength(grid, grid_width, grid_height, sensor_pos, detection_radius)
    if strength > best_strength {
      best_strength = strength
      best_index = i
    }
  }
  if best_strength > minimum_strength {
    sensors[best_index]
  } else {
    direction
  }
}

///|
/// 最も近い食べ物のインデックスを返す(トーラス距離基準)。見つからない場合は-1。
pub fn find_nearest_food_index(
  ant_position : Position,
  food_x : FixedArray[Double],
  food_y : FixedArray[Double],
  food_count : Int,
  world_width : Double,
  world_height : Double,
  max_distance : Double,
) -> Int {
  let mut nearest_index = -1
  let mut min_distance = max_distance
  for i in 0..<food_count {
    let food_position = { x: food_x[i], y: food_y[i] }
    let distance = torus_distance(ant_position, food_position, world_width, world_height)
    if distance < min_distance {
      nearest_index = i
      min_distance = distance
    }
  }
  nearest_index
}
