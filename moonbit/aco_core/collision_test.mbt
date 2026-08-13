///|
test "no other ants leaves direction and position unchanged" {
  let other_x : FixedArray[Double] = []
  let other_y : FixedArray[Double] = []
  let result = avoid_collisions(
    { x: 50.0, y: 50.0 },
    0.0,
    other_x,
    other_y,
    0,
    0,
    100.0,
    100.0,
    8.0,
    0.5,
  )
  assert_eq(result.direction, 0.0)
  assert_eq(result.position, { x: 50.0, y: 50.0 })
}

///|
test "excludes the current ant itself via self_index" {
  let other_x : FixedArray[Double] = [52.0]
  let other_y : FixedArray[Double] = [50.0]
  let result = avoid_collisions(
    { x: 50.0, y: 50.0 },
    0.0,
    other_x,
    other_y,
    1,
    0,
    100.0,
    100.0,
    8.0,
    0.5,
  )
  assert_eq(result.direction, 0.0)
  assert_eq(result.position, { x: 50.0, y: 50.0 })
}

///|
test "ignores ants outside the avoidance radius" {
  let other_x : FixedArray[Double] = [70.0]
  let other_y : FixedArray[Double] = [50.0]
  let result = avoid_collisions(
    { x: 50.0, y: 50.0 },
    0.0,
    other_x,
    other_y,
    1,
    5,
    100.0,
    100.0,
    8.0,
    0.5,
  )
  assert_eq(result.direction, 0.0)
  assert_eq(result.position, { x: 50.0, y: 50.0 })
}

///|
test "steers away from a single nearby ant with default-equivalent params" {
  let other_x : FixedArray[Double] = [54.0]
  let other_y : FixedArray[Double] = [50.0]
  let result = avoid_collisions(
    { x: 50.0, y: 50.0 },
    0.0,
    other_x,
    other_y,
    1,
    5,
    100.0,
    100.0,
    8.0,
    0.5,
  )
  assert_true((result.direction - @math.PI / 2.0).abs() < 1.0e-10)
  assert_true((result.position.x - 49.875).abs() < 1.0e-10)
  assert_true((result.position.y - 50.0).abs() < 1.0e-10)
}

///|
test "accumulates avoidance force from multiple nearby ants and caps strength at 1" {
  let other_x : FixedArray[Double] = [54.0, 50.0]
  let other_y : FixedArray[Double] = [50.0, 54.0]
  let result = avoid_collisions(
    { x: 50.0, y: 50.0 },
    0.0,
    other_x,
    other_y,
    2,
    9,
    100.0,
    100.0,
    8.0,
    0.5,
  )
  assert_true((result.direction - -3.0 * @math.PI / 4.0).abs() < 1.0e-10)
  assert_true((result.position.x - 49.75).abs() < 1.0e-10)
  assert_true((result.position.y - 49.75).abs() < 1.0e-10)
}

///|
test "computes avoidance across the torus wrap boundary" {
  let other_x : FixedArray[Double] = [98.0]
  let other_y : FixedArray[Double] = [50.0]
  let result = avoid_collisions(
    { x: 2.0, y: 50.0 },
    0.0,
    other_x,
    other_y,
    1,
    5,
    100.0,
    100.0,
    8.0,
    0.5,
  )
  assert_true((result.direction - 0.0).abs() < 1.0e-10)
  assert_true((result.position.x - 2.125).abs() < 1.0e-10)
  assert_true((result.position.y - 50.0).abs() < 1.0e-10)
}
