///|
test "grid_index computes row-major index" {
  assert_eq(grid_index(2, 4, 10), 42)
}

///|
test "deposit_pheromone creates a new entry" {
  let grid = FixedArray::make(100, 0.0)
  deposit_pheromone(grid, 10, 10, { x: 23.0, y: 47.0 }, 5.0)
  // floor(23/10)=2, floor(47/10)=4 -> index 2 + 4*10 = 42
  assert_eq(grid[42], 5.0)
}

///|
test "deposit_pheromone accumulates onto an existing cell" {
  let grid = FixedArray::make(100, 0.0)
  grid[42] = 90.0
  deposit_pheromone(grid, 10, 10, { x: 23.0, y: 47.0 }, 5.0)
  assert_eq(grid[42], 95.0)
}

///|
test "deposit_pheromone caps accumulated intensity at 100" {
  let grid = FixedArray::make(100, 0.0)
  grid[42] = 98.0
  deposit_pheromone(grid, 10, 10, { x: 23.0, y: 47.0 }, 5.0)
  assert_eq(grid[42], 100.0)
}

///|
test "decay_pheromones reduces intensity above the threshold" {
  let grid = FixedArray::make(100, 0.0)
  grid[42] = 50.0
  decay_pheromones(grid, 0.99)
  assert_true(grid[42] < 50.0)
  assert_true(grid[42] > 0.0)
}

///|
test "decay_pheromones zeroes out intensity below the threshold" {
  let grid = FixedArray::make(100, 0.0)
  grid[42] = 0.05
  decay_pheromones(grid, 0.5)
  assert_eq(grid[42], 0.0)
}

///|
test "decay_pheromones evaporates less with a higher decayRate" {
  let strong_grid = FixedArray::make(100, 0.0)
  strong_grid[42] = 50.0
  decay_pheromones(strong_grid, 0.9)
  let weak_grid = FixedArray::make(100, 0.0)
  weak_grid[42] = 50.0
  decay_pheromones(weak_grid, 0.999)
  assert_true(weak_grid[42] > strong_grid[42])
}

///|
test "pheromone_strength sums contributions within the detection radius" {
  let grid = FixedArray::make(100, 0.0)
  // cell (1,0) covers position (10..20, 0..10); put 60 intensity there.
  grid[grid_index(1, 0, 10)] = 60.0
  let strength = pheromone_strength(
    grid,
    10,
    10,
    { x: 0.0, y: 0.0 },
    100.0,
    100.0,
    30.0,
  )
  assert_true(strength > 0.0)
}

///|
test "pheromone_strength detects a pheromone across the torus boundary" {
  // world 100x100 / grid 10x10 / cell size 10.
  // Pheromone sits in cell (9,5) -> center (95.0, 55.0), i.e. hard against the
  // x=100 edge. The query position sits against the OPPOSITE edge (x=2.0).
  // Plain (non-torus) distance is 93.0 -> far outside the 30.0 radius, but the
  // torus distance is min(93.0, 100.0-93.0) = 7.0 -> well inside it.
  let grid = FixedArray::make(100, 0.0)
  grid[grid_index(9, 5, 10)] = 100.0
  let strength = pheromone_strength(
    grid,
    10,
    10,
    { x: 2.0, y: 55.0 },
    100.0,
    100.0,
    30.0,
  )
  // 100.0 / (1.0 + 7.0) = 12.5
  assert_true(strength > 0.0)
  assert_true((strength - 12.5).abs() < 1.0e-9)
}

///|
test "pheromone_strength counts each cell once when the scan wraps around" {
  // world 40x40 / grid 4x4. cell_radius for radius 30.0 is 4, so the naive
  // scan window (9 cells wide) is wider than the grid itself; without clamping
  // the span, modulo-wrapping would visit the same cell several times and
  // inflate the total.
  let grid = FixedArray::make(16, 0.0)
  grid[grid_index(0, 0, 4)] = 100.0
  let strength = pheromone_strength(
    grid,
    4,
    4,
    { x: 5.0, y: 5.0 },
    40.0,
    40.0,
    30.0,
  )
  // distance 0.0 from the cell center -> 100.0 / (1.0 + 0.0), counted once.
  assert_true((strength - 100.0).abs() < 1.0e-9)
}

///|
test "pheromone_strength is zero for an empty grid" {
  let grid = FixedArray::make(100, 0.0)
  assert_eq(
    pheromone_strength(grid, 10, 10, { x: 0.0, y: 0.0 }, 100.0, 100.0, 30.0),
    0.0,
  )
}

///|
test "pheromone_strength respects the detection radius boundary" {
  let grid = FixedArray::make(100, 0.0)
  // Query position: {x: 0.0, y: 0.0}
  // detection_radius: 30.0, cell_size: 10.0
  // cell_radius = (30.0/10.0).to_int() + 1 = 3 + 1 = 4

  // Test 1: Cell (2, 1) is INSIDE the detection radius boundary
  // cell_center = (2 * 10.0 + 5.0, 1 * 10.0 + 5.0) = (25.0, 15.0)
  // distance = sqrt((0-25)^2 + (0-15)^2) = sqrt(625 + 225) = sqrt(850) ≈ 29.15
  // Since 29.15 < 30.0, this cell should contribute
  grid[grid_index(2, 1, 10)] = 40.0
  let strength_inside = pheromone_strength(
    grid,
    10,
    10,
    { x: 0.0, y: 0.0 },
    100.0,
    100.0,
    30.0,
  )
  assert_true(strength_inside > 0.0)

  // Test 2: Cell (3, 0) is OUTSIDE the detection radius boundary
  // cell_center = (3 * 10.0 + 5.0, 0 * 10.0 + 5.0) = (35.0, 5.0)
  // distance = sqrt((0-35)^2 + (0-5)^2) = sqrt(1225 + 25) = sqrt(1250) ≈ 35.36
  // Since 35.36 > 30.0, this cell should NOT contribute
  for i in 0..<100 {
    grid[i] = 0.0
  }
  grid[grid_index(3, 0, 10)] = 40.0
  let strength_outside = pheromone_strength(
    grid,
    10,
    10,
    { x: 0.0, y: 0.0 },
    100.0,
    100.0,
    30.0,
  )
  assert_eq(strength_outside, 0.0)
}
