///|
test "follow_pheromone keeps direction unchanged when all sensors are out of range" {
  let grid = FixedArray::make(400, 0.0)
  // put a pheromone far outside the 30-unit detection radius
  grid[grid_index(19, 19, 20)] = 100.0
  let result = follow_pheromone(
    grid,
    20,
    20,
    { x: 0.0, y: 0.0 },
    1.23,
    100.0,
    100.0,
    20.0,
    @math.PI / 4.0,
    30.0,
    0.1,
  )
  assert_eq(result, 1.23)
}

///|
test "follow_pheromone keeps direction unchanged when the strongest signal is centered" {
  // center sensor position for direction=0 is (20, 0) -> grid cell (2, 0) in a 10-cell grid
  let grid = FixedArray::make(100, 0.0)
  grid[grid_index(2, 0, 10)] = 100.0
  let result = follow_pheromone(
    grid,
    10,
    10,
    { x: 0.0, y: 0.0 },
    0.0,
    100.0,
    100.0,
    20.0,
    @math.PI / 4.0,
    30.0,
    0.1,
  )
  assert_eq(result, 0.0)
}

///|
test "follow_pheromone steers across the torus boundary" {
  // world 100x100 / grid 10x10. Pheromone in cell (9,5) -> center (95.0, 55.0),
  // against the x=100 edge. The ant sits against the opposite edge at (2.0,55.0)
  // heading 3π/4 (down-left). Its right sensor (direction + sensor_angle = π)
  // lands at (-18.0, 55.0) -> wrapped (82.0, 55.0), only 13.0 away from the
  // pheromone on the torus, so it must win and steer the ant to π.
  let grid = FixedArray::make(100, 0.0)
  grid[grid_index(9, 5, 10)] = 100.0
  let result = follow_pheromone(
    grid,
    10,
    10,
    { x: 2.0, y: 55.0 },
    3.0 * @math.PI / 4.0,
    100.0,
    100.0,
    20.0,
    @math.PI / 4.0,
    30.0,
    0.1,
  )
  assert_true((result - @math.PI).abs() < 1.0e-9)
}

///|
test "find_nearest_food_index returns the closest food among several" {
  let food_x : FixedArray[Double] = [10.0, 5.0, 20.0]
  let food_y : FixedArray[Double] = [0.0, 0.0, 0.0]
  let idx = find_nearest_food_index(
    { x: 0.0, y: 0.0 },
    food_x,
    food_y,
    3,
    100.0,
    100.0,
    1000.0,
  )
  assert_eq(idx, 1)
}

///|
test "find_nearest_food_index returns -1 when there are no foods" {
  let food_x : FixedArray[Double] = []
  let food_y : FixedArray[Double] = []
  let idx = find_nearest_food_index(
    { x: 0.0, y: 0.0 },
    food_x,
    food_y,
    0,
    100.0,
    100.0,
    1000.0,
  )
  assert_eq(idx, -1)
}

///|
test "find_nearest_food_index returns -1 when nearest food is beyond max_distance" {
  let food_x : FixedArray[Double] = [50.0]
  let food_y : FixedArray[Double] = [0.0]
  let idx = find_nearest_food_index(
    { x: 0.0, y: 0.0 },
    food_x,
    food_y,
    1,
    100.0,
    100.0,
    10.0,
  )
  assert_eq(idx, -1)
}
