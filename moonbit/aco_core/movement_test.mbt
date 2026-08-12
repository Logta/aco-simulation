///|
test "move_towards_target returns the target once within speed distance" {
  let result = move_towards_target({ x: 0.0, y: 0.0 }, { x: 1.0, y: 0.0 }, 100.0, 100.0, 2.0)
  assert_eq(result, { x: 1.0, y: 0.0 })
}

///|
test "move_towards_target moves by exactly speed units toward a distant target" {
  let result = move_towards_target({ x: 0.0, y: 0.0 }, { x: 10.0, y: 0.0 }, 100.0, 100.0, 2.0)
  assert_eq(result, { x: 2.0, y: 0.0 })
}

///|
test "move_towards_target lands exactly on target when distance equals speed" {
  let result = move_towards_target({ x: 0.0, y: 0.0 }, { x: 3.0, y: 4.0 }, 100.0, 100.0, 5.0)
  assert_eq(result, { x: 3.0, y: 4.0 })
}

///|
test "move_towards_target takes the shorter path across the torus boundary" {
  let result = move_towards_target({ x: 5.0, y: 50.0 }, { x: 95.0, y: 50.0 }, 100.0, 100.0, 2.0)
  assert_eq(result, { x: 3.0, y: 50.0 })
}

///|
test "move_ant moves in a straight line when random_turn_range is 0" {
  let rng = rng_new(1)
  let result = move_ant(rng, { x: 0.0, y: 0.0 }, 0.0, 100.0, 100.0, 2.0, 0.0)
  assert_eq(result.direction, 0.0)
  assert_true((result.position.x - 2.0).abs() < 1.0e-10)
  assert_true((result.position.y - 0.0).abs() < 1.0e-10)
}

///|
test "move_with_bias keeps direction unchanged when aligned and no randomness" {
  let rng = rng_new(1)
  let result = move_with_bias(
    rng, { x: 0.0, y: 0.0 }, 0.0, { x: 10.0, y: 0.0 }, 100.0, 100.0, 2.0, 0.0, 0.3,
  )
  assert_eq(result.direction, 0.0)
  assert_true((result.position.x - 2.0).abs() < 1.0e-10)
}

///|
test "move_with_bias blends toward the target direction proportional to bias_strength" {
  let rng = rng_new(1)
  let result = move_with_bias(
    rng, { x: 0.0, y: 0.0 }, 0.0, { x: 0.0, y: 10.0 }, 100.0, 100.0, 2.0, 0.0, 0.5,
  )
  let expected_direction = @math.PI / 4.0
  assert_true((result.direction - expected_direction).abs() < 1.0e-10)
}
