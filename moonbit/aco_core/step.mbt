///|
/// 1フレーム分のシミュレーションステップを実行する。全ての配列はin-placeで
/// 更新される。JS側は呼び出し後、同じ配列をそのまま読み直す。
#export_name("step")
pub fn step(
  rng : Rng,
  ant_x : FixedArray[Double],
  ant_y : FixedArray[Double],
  ant_direction : FixedArray[Double],
  ant_has_food : FixedArray[Byte],
  ant_target_food_index : FixedArray[Int],
  ant_food_amount : FixedArray[Double],
  ant_count : Int,
  food_x : FixedArray[Double],
  food_y : FixedArray[Double],
  food_amount : FixedArray[Double],
  food_count : Int,
  pheromone_to_food : FixedArray[Double],
  pheromone_to_nest : FixedArray[Double],
  grid_width : Int,
  grid_height : Int,
  nest_x : Double,
  nest_y : Double,
  world_width : Double,
  world_height : Double,
  pheromone_deposit_amount : Double,
  pheromone_tracking_strength : Double,
) -> Unit {
  let nest = { x: nest_x, y: nest_y }
  // 各アリの行動を計算する。avoid_collisionsは他アリの「現在の(更新前)位置」を
  // 参照するため、書き戻しは全アリ分の計算が終わった後にまとめて行う。
  let result_x = FixedArray::make(ant_count, 0.0)
  let result_y = FixedArray::make(ant_count, 0.0)
  let result_direction = FixedArray::make(ant_count, 0.0)
  let result_has_food = FixedArray::make(ant_count, (0 : Byte))
  let result_target_food_index = FixedArray::make(ant_count, -1)
  let result_food_amount = FixedArray::make(ant_count, -1.0)
  for i in 0..<ant_count {
    let result = execute_ant_behavior(
      rng, ant_x, ant_y, ant_direction, ant_has_food, ant_target_food_index, ant_food_amount, i,
      ant_count, food_x, food_y, food_amount, food_count, pheromone_to_food, pheromone_to_nest,
      grid_width, grid_height, nest, world_width, world_height, pheromone_deposit_amount,
      pheromone_tracking_strength,
    )
    result_x[i] = result.position.x
    result_y[i] = result.position.y
    result_direction[i] = result.direction
    result_has_food[i] = if result.has_food { 1 } else { 0 }
    result_target_food_index[i] = result.target_food_index
    result_food_amount[i] = result.food_amount
    if result.food_delta_index >= 0 {
      food_amount[result.food_delta_index] = result.food_delta_amount
    }
  }
  for i in 0..<ant_count {
    ant_x[i] = result_x[i]
    ant_y[i] = result_y[i]
    ant_direction[i] = result_direction[i]
    ant_has_food[i] = result_has_food[i]
    ant_target_food_index[i] = result_target_food_index[i]
    ant_food_amount[i] = result_food_amount[i]
  }
}

///|
/// フェロモン減衰を実行する(JS側が間隔を空けて呼ぶ)。
#export_name("decay")
pub fn decay(
  pheromone_to_food : FixedArray[Double],
  pheromone_to_nest : FixedArray[Double],
  decay_rate : Double,
) -> Unit {
  decay_pheromones(pheromone_to_food, decay_rate)
  decay_pheromones(pheromone_to_nest, decay_rate)
}

///|
/// JS側が乱数シードを渡してRngを初期化するためのエクスポート。
#export_name("rng_create")
pub fn rng_create(seed : UInt) -> Rng {
  rng_new(seed)
}
