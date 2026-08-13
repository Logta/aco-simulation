///|
let food_detection_range : Double = 20.0

///|
let food_collection_range : Double = 10.0

///|
let nest_arrival_range : Double = 10.0

///|
let collision_avoidance_radius : Double = 6.0

///|
let ant_speed : Double = 2.0

///|
let food_approach_bias : Double = 0.4

///|
pub(all) struct AntBehaviorResult {
  position : Position
  direction : Double
  has_food : Bool
  target_food_index : Int
  food_amount : Double
  food_delta_index : Int
  food_delta_amount : Double
} derive(Eq, Debug)

///|
fn food_quality_multiplier(food_amount : Double) -> Double {
  if food_amount <= 0.0 {
    1.0
  } else {
    1.0 + @cmp.minimum(food_amount / 30.0, 2.0)
  }
}

///|
/// 1匹分のアリの行動を計算する。フェロモングリッドへの付与はin-placeで行う。
pub fn execute_ant_behavior(
  rng : Rng,
  ant_x : FixedArray[Double],
  ant_y : FixedArray[Double],
  ant_direction : FixedArray[Double],
  ant_has_food : FixedArray[Byte],
  ant_target_food_index : FixedArray[Int],
  ant_food_amount : FixedArray[Double],
  ant_index : Int,
  ant_count : Int,
  food_x : FixedArray[Double],
  food_y : FixedArray[Double],
  food_amount : FixedArray[Double],
  food_count : Int,
  pheromone_to_food : FixedArray[Double],
  pheromone_to_nest : FixedArray[Double],
  grid_width : Int,
  grid_height : Int,
  nest : Position,
  world_width : Double,
  world_height : Double,
  pheromone_deposit_amount : Double,
  pheromone_tracking_strength : Double,
) -> AntBehaviorResult {
  let position = { x: ant_x[ant_index], y: ant_y[ant_index] }
  let direction = ant_direction[ant_index]
  if ant_has_food[ant_index] == 1 {
    execute_returning_behavior(
      rng, position, direction, ant_food_amount[ant_index], ant_x, ant_y, ant_index, ant_count,
      pheromone_to_food, grid_width, grid_height, nest, world_width, world_height,
      pheromone_deposit_amount,
    )
  } else {
    execute_foraging_behavior(
      rng, position, direction, ant_x, ant_y, ant_index, ant_count, food_x, food_y, food_amount,
      food_count, pheromone_to_food, pheromone_to_nest, grid_width, grid_height, world_width,
      world_height, pheromone_tracking_strength,
    )
  }
}

///|
fn execute_returning_behavior(
  rng : Rng,
  position : Position,
  direction : Double,
  food_amount : Double,
  ant_x : FixedArray[Double],
  ant_y : FixedArray[Double],
  ant_index : Int,
  ant_count : Int,
  pheromone_to_food : FixedArray[Double],
  grid_width : Int,
  grid_height : Int,
  nest : Position,
  world_width : Double,
  world_height : Double,
  pheromone_deposit_amount : Double,
) -> AntBehaviorResult {
  let distance_to_nest = torus_distance(position, nest, world_width, world_height)
  if distance_to_nest < nest_arrival_range {
    {
      position,
      direction,
      has_food: false,
      target_food_index: -1,
      food_amount: -1.0,
      food_delta_index: -1,
      food_delta_amount: 0.0,
    }
  } else {
    let new_position = move_towards_target(position, nest, world_width, world_height, ant_speed)
    let dx = nest.x - position.x
    let dy = nest.y - position.y
    let wrapped_dx = if dx > world_width / 2.0 {
      dx - world_width
    } else if dx < -world_width / 2.0 {
      dx + world_width
    } else {
      dx
    }
    let wrapped_dy = if dy > world_height / 2.0 {
      dy - world_height
    } else if dy < -world_height / 2.0 {
      dy + world_height
    } else {
      dy
    }
    let new_direction = @math.atan2(wrapped_dy, wrapped_dx)
    let avoidance = avoid_collisions(
      new_position, new_direction, ant_x, ant_y, ant_count, ant_index, world_width, world_height,
      collision_avoidance_radius, 0.5,
    )
    deposit_pheromone(
      pheromone_to_food, grid_width, grid_height, position,
      pheromone_deposit_amount * food_quality_multiplier(food_amount),
    )
    {
      position: avoidance.position,
      direction: avoidance.direction,
      has_food: true,
      target_food_index: -1,
      food_amount,
      food_delta_index: -1,
      food_delta_amount: 0.0,
    }
  }
}

///|
fn execute_foraging_behavior(
  rng : Rng,
  position : Position,
  direction : Double,
  ant_x : FixedArray[Double],
  ant_y : FixedArray[Double],
  ant_index : Int,
  ant_count : Int,
  food_x : FixedArray[Double],
  food_y : FixedArray[Double],
  food_amount : FixedArray[Double],
  food_count : Int,
  pheromone_to_food : FixedArray[Double],
  pheromone_to_nest : FixedArray[Double],
  grid_width : Int,
  grid_height : Int,
  world_width : Double,
  world_height : Double,
  pheromone_tracking_strength : Double,
) -> AntBehaviorResult {
  let nearby_food_index = find_nearest_food_index(
    position, food_x, food_y, food_count, world_width, world_height, food_detection_range,
  )
  if nearby_food_index == -1 {
    execute_exploration(
      rng, position, direction, ant_x, ant_y, ant_index, ant_count, pheromone_to_food,
      grid_width, grid_height, world_width, world_height, pheromone_tracking_strength,
    )
  } else {
    let food_position = { x: food_x[nearby_food_index], y: food_y[nearby_food_index] }
    let distance_to_food = torus_distance(position, food_position, world_width, world_height)
    if distance_to_food < food_collection_range {
      let new_amount = food_amount[nearby_food_index] - 1.0
      {
        position,
        direction,
        has_food: true,
        target_food_index: nearby_food_index,
        food_amount: food_amount[nearby_food_index],
        food_delta_index: nearby_food_index,
        food_delta_amount: new_amount,
      }
    } else {
      let bias_move = move_with_bias(
        rng, position, direction, food_position, world_width, world_height, ant_speed, 0.8,
        food_approach_bias,
      )
      let avoidance = avoid_collisions(
        bias_move.position, bias_move.direction, ant_x, ant_y, ant_count, ant_index, world_width,
        world_height, collision_avoidance_radius, 0.5,
      )
      {
        position: avoidance.position,
        direction: avoidance.direction,
        has_food: false,
        target_food_index: -1,
        food_amount: -1.0,
        food_delta_index: -1,
        food_delta_amount: 0.0,
      }
    }
  }
}

///|
fn execute_exploration(
  rng : Rng,
  position : Position,
  direction : Double,
  ant_x : FixedArray[Double],
  ant_y : FixedArray[Double],
  ant_index : Int,
  ant_count : Int,
  pheromone_to_food : FixedArray[Double],
  grid_width : Int,
  grid_height : Int,
  world_width : Double,
  world_height : Double,
  pheromone_tracking_strength : Double,
) -> AntBehaviorResult {
  let pheromone_direction = follow_pheromone(
    pheromone_to_food, grid_width, grid_height, position, direction, world_width, world_height,
    20.0, @math.PI / 4.0, 30.0, 0.1,
  )
  let direction_diff = (pheromone_direction - direction).abs()
  let normalized_diff = @cmp.minimum(direction_diff, 2.0 * @math.PI - direction_diff)
  let should_follow =
    rng_next_double(rng) < pheromone_tracking_strength && normalized_diff > 0.1
  let move_result = if should_follow {
    move_ant(rng, position, pheromone_direction, world_width, world_height, ant_speed, 0.5)
  } else {
    move_ant(rng, position, direction, world_width, world_height, ant_speed, 0.5)
  }
  let avoidance = avoid_collisions(
    move_result.position, move_result.direction, ant_x, ant_y, ant_count, ant_index, world_width,
    world_height, collision_avoidance_radius, 0.5,
  )
  {
    position: avoidance.position,
    direction: avoidance.direction,
    has_food: false,
    target_food_index: -1,
    food_amount: -1.0,
    food_delta_index: -1,
    food_delta_amount: 0.0,
  }
}
