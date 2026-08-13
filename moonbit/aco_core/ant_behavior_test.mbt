///|
test "foraging ant with no nearby food moves and deposits no pheromone" {
  let rng = rng_new(1)
  let ant_x : FixedArray[Double] = [100.0]
  let ant_y : FixedArray[Double] = [100.0]
  let ant_direction : FixedArray[Double] = [0.0]
  let ant_has_food : FixedArray[Byte] = [0]
  let ant_target_food_index : FixedArray[Int] = [-1]
  let ant_food_amount : FixedArray[Double] = [-1.0]
  let food_x : FixedArray[Double] = []
  let food_y : FixedArray[Double] = []
  let food_amount : FixedArray[Double] = []
  let pheromone_to_food = FixedArray::make(4800, 0.0)
  let pheromone_to_nest = FixedArray::make(4800, 0.0)
  let result = execute_ant_behavior(
    rng, ant_x, ant_y, ant_direction, ant_has_food, ant_target_food_index, ant_food_amount,
    0, 1, food_x, food_y, food_amount, 0, pheromone_to_food, pheromone_to_nest, 80, 60,
    { x: 400.0, y: 300.0 }, 800.0, 600.0, 2.0, 0.7,
  )
  assert_eq(result.has_food, false)
  assert_eq(result.food_delta_index, -1)
}

///|
test "foraging ant collects food when within collection range" {
  let rng = rng_new(1)
  let ant_x : FixedArray[Double] = [100.0]
  let ant_y : FixedArray[Double] = [100.0]
  let ant_direction : FixedArray[Double] = [0.0]
  let ant_has_food : FixedArray[Byte] = [0]
  let ant_target_food_index : FixedArray[Int] = [-1]
  let ant_food_amount : FixedArray[Double] = [-1.0]
  let food_x : FixedArray[Double] = [105.0]
  let food_y : FixedArray[Double] = [105.0]
  let food_amount : FixedArray[Double] = [10.0]
  let pheromone_to_food = FixedArray::make(4800, 0.0)
  let pheromone_to_nest = FixedArray::make(4800, 0.0)
  let result = execute_ant_behavior(
    rng, ant_x, ant_y, ant_direction, ant_has_food, ant_target_food_index, ant_food_amount,
    0, 1, food_x, food_y, food_amount, 1, pheromone_to_food, pheromone_to_nest, 80, 60,
    { x: 400.0, y: 300.0 }, 800.0, 600.0, 2.0, 0.7,
  )
  assert_eq(result.has_food, true)
  assert_eq(result.target_food_index, 0)
  assert_eq(result.food_delta_index, 0)
  assert_true((result.food_delta_amount - 9.0).abs() < 1.0e-10)
}

///|
test "returning ant drops food and stops when close to the nest" {
  let rng = rng_new(1)
  let ant_x : FixedArray[Double] = [395.0]
  let ant_y : FixedArray[Double] = [295.0]
  let ant_direction : FixedArray[Double] = [0.0]
  let ant_has_food : FixedArray[Byte] = [1]
  let ant_target_food_index : FixedArray[Int] = [0]
  let ant_food_amount : FixedArray[Double] = [10.0]
  let food_x : FixedArray[Double] = []
  let food_y : FixedArray[Double] = []
  let food_amount : FixedArray[Double] = []
  let pheromone_to_food = FixedArray::make(4800, 0.0)
  let pheromone_to_nest = FixedArray::make(4800, 0.0)
  let result = execute_ant_behavior(
    rng, ant_x, ant_y, ant_direction, ant_has_food, ant_target_food_index, ant_food_amount,
    0, 1, food_x, food_y, food_amount, 0, pheromone_to_food, pheromone_to_nest, 80, 60,
    { x: 400.0, y: 300.0 }, 800.0, 600.0, 2.0, 0.7,
  )
  assert_eq(result.has_food, false)
  assert_eq(result.target_food_index, -1)
  assert_eq(result.food_amount, -1.0)
}

///|
test "returning ant away from the nest deposits toFood pheromone" {
  let rng = rng_new(1)
  let ant_x : FixedArray[Double] = [100.0]
  let ant_y : FixedArray[Double] = [100.0]
  let ant_direction : FixedArray[Double] = [0.0]
  let ant_has_food : FixedArray[Byte] = [1]
  let ant_target_food_index : FixedArray[Int] = [0]
  let ant_food_amount : FixedArray[Double] = [10.0]
  let food_x : FixedArray[Double] = []
  let food_y : FixedArray[Double] = []
  let food_amount : FixedArray[Double] = []
  let pheromone_to_food = FixedArray::make(4800, 0.0)
  let pheromone_to_nest = FixedArray::make(4800, 0.0)
  let _ = execute_ant_behavior(
    rng, ant_x, ant_y, ant_direction, ant_has_food, ant_target_food_index, ant_food_amount,
    0, 1, food_x, food_y, food_amount, 0, pheromone_to_food, pheromone_to_nest, 80, 60,
    { x: 400.0, y: 300.0 }, 800.0, 600.0, 2.0, 0.7,
  )
  // ant at (100,100) -> grid cell (10, 10) in an 80x60 grid (cell size 10)
  assert_true(pheromone_to_food[grid_index(10, 10, 80)] > 0.0)
}
