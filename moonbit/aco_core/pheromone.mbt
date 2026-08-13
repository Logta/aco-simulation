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
///
/// TS版(`src/lib/aco/pathfinding.ts`の`followPheromone`)は距離計算に
/// `torusDistance`を使っており、世界の端をまたいだフェロモンも検出できる。
/// 本関数も同じくトーラス前提で走査する:
///   - 走査対象セルのインデックスはグリッド範囲外を切り捨てずにラップする
///   - 距離は`torus_distance`で測る(直線距離と回り込み距離の短い方)
/// これを怠ると、世界の端から`detection_radius`以内でフェロモン検出が
/// 静かに機能しなくなる。
pub fn pheromone_strength(
  grid : FixedArray[Double],
  grid_width : Int,
  grid_height : Int,
  position : Position,
  world_width : Double,
  world_height : Double,
  detection_radius : Double,
) -> Double {
  // センサー位置は世界の外(負値など)になり得るため、まず世界内に畳み込む。
  // `Double::to_int()`はゼロ方向への切り捨てなので負座標のままではセル位置が
  // ずれるうえ、`torus_distance`も1周期内の点でしか正しく機能しない。
  let origin = torus_wrap(position, world_width, world_height)
  let center_x = (origin.x / pheromone_cell_size).to_int()
  let center_y = (origin.y / pheromone_cell_size).to_int()
  let cell_radius = (detection_radius / pheromone_cell_size).to_int() + 1
  // 走査幅がグリッド幅を超えると、ラップによって同じセルを複数回数えてしまう。
  // TS版は各フェロモンをちょうど1回だけ数えるため、幅をグリッドサイズで抑える。
  let span_x = @cmp.minimum(cell_radius * 2 + 1, grid_width)
  let span_y = @cmp.minimum(cell_radius * 2 + 1, grid_height)
  let mut total = 0.0
  for iy in 0..<span_y {
    let gy = center_y - cell_radius + iy
    let wrapped_gy = (gy % grid_height + grid_height) % grid_height
    for ix in 0..<span_x {
      let gx = center_x - cell_radius + ix
      let wrapped_gx = (gx % grid_width + grid_width) % grid_width
      let intensity = grid[grid_index(wrapped_gx, wrapped_gy, grid_width)]
      if intensity > 0.0 {
        let cell_center = {
          x: wrapped_gx.to_double() * pheromone_cell_size +
          pheromone_cell_size / 2.0,
          y: wrapped_gy.to_double() * pheromone_cell_size +
          pheromone_cell_size / 2.0,
        }
        let distance = torus_distance(
          origin, cell_center, world_width, world_height,
        )
        if distance < detection_radius {
          total += intensity / (1.0 + distance)
        }
      }
    }
  }
  total
}
