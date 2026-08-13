///|
let pheromone_cell_size : Double = 10.0

///|
let pheromone_max_intensity : Double = 100.0

///|
let pheromone_min_threshold : Double = 0.1

///|
let pheromone_base_evaporation : Double = 0.05

///|
/// row-major インデックス計算。
pub fn grid_index(grid_x : Int, grid_y : Int, grid_width : Int) -> Int {
  grid_y * grid_width + grid_x
}

///|
/// 指定位置のセルにフェロモンをin-placeで加算する(100で飽和)。
pub fn deposit_pheromone(
  grid : FixedArray[Double],
  grid_width : Int,
  grid_height : Int,
  position : Position,
  amount : Double,
) -> Unit {
  let grid_x = (position.x / pheromone_cell_size).to_int()
  let grid_y = (position.y / pheromone_cell_size).to_int()
  let idx = grid_index(grid_x, grid_y, grid_width)
  grid[idx] = @cmp.minimum(pheromone_max_intensity, grid[idx] + amount)
}

///|
/// 全セルを対数的蒸発モデルでin-place減衰させる。しきい値未満は0にする。
pub fn decay_pheromones(grid : FixedArray[Double], decay_rate : Double) -> Unit {
  for i in 0..<grid.length() {
    let intensity = grid[i]
    if intensity > 0.0 {
      let log_factor = @math.log10(intensity + 1.0) / @math.log10(101.0)
      let evaporation_strength = (1.0 - decay_rate) * 10.0
      let log_evaporation = log_factor * evaporation_strength * intensity
      let total_evaporation = pheromone_base_evaporation + log_evaporation
      let decayed = intensity - total_evaporation
      if decayed > pheromone_min_threshold {
        grid[i] = decayed
      } else {
        grid[i] = 0.0
      }
    }
  }
}

///|
/// 指定位置の周辺(detection_radius以内)のフェロモン強度を合計する。
/// TS版は全件走査だったが、密グリッドを利用して周辺セルのみ走査する。
pub fn pheromone_strength(
  grid : FixedArray[Double],
  grid_width : Int,
  grid_height : Int,
  position : Position,
  detection_radius : Double,
) -> Double {
  let center_x = (position.x / pheromone_cell_size).to_int()
  let center_y = (position.y / pheromone_cell_size).to_int()
  let cell_radius = (detection_radius / pheromone_cell_size).to_int() + 1
  let mut total = 0.0
  for dy in -cell_radius..<(cell_radius + 1) {
    for dx in -cell_radius..<(cell_radius + 1) {
      let gx = center_x + dx
      let gy = center_y + dy
      if gx >= 0 && gx < grid_width && gy >= 0 && gy < grid_height {
        let intensity = grid[grid_index(gx, gy, grid_width)]
        if intensity > 0.0 {
          let cell_center_x = gx.to_double() * pheromone_cell_size +
            pheromone_cell_size / 2.0
          let cell_center_y = gy.to_double() * pheromone_cell_size +
            pheromone_cell_size / 2.0
          let ddx = position.x - cell_center_x
          let ddy = position.y - cell_center_y
          let distance = (ddx * ddx + ddy * ddy).sqrt()
          if distance < detection_radius {
            total += intensity / (1.0 + distance)
          }
        }
      }
    }
  }
  total
}
