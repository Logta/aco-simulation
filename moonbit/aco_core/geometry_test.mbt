///|
test "torus_wrap within bounds" {
  assert_eq(torus_wrap({ x: 50.0, y: 30.0 }, 100.0, 100.0), { x: 50.0, y: 30.0 })
}

///|
test "torus_wrap at exact boundary" {
  assert_eq(torus_wrap({ x: 100.0, y: 100.0 }, 100.0, 100.0), { x: 0.0, y: 0.0 })
}

///|
test "torus_wrap negative wraps positive" {
  assert_eq(torus_wrap({ x: -10.0, y: -5.0 }, 100.0, 50.0), { x: 90.0, y: 45.0 })
}

///|
test "torus_wrap large value wraps multiple times" {
  assert_eq(torus_wrap({ x: 250.0, y: 130.0 }, 100.0, 50.0), { x: 50.0, y: 30.0 })
}

///|
test "torus_distance direct 3-4-5" {
  assert_eq(torus_distance({ x: 0.0, y: 0.0 }, { x: 3.0, y: 4.0 }, 100.0, 100.0), 5.0)
}

///|
test "torus_distance same point is zero" {
  assert_eq(torus_distance({ x: 10.0, y: 10.0 }, { x: 10.0, y: 10.0 }, 100.0, 100.0), 0.0)
}

///|
test "torus_distance shorter via wrap on x" {
  assert_eq(torus_distance({ x: 5.0, y: 50.0 }, { x: 95.0, y: 50.0 }, 100.0, 100.0), 10.0)
}

///|
test "torus_distance shorter via wrap on both axes" {
  let d = torus_distance({ x: 5.0, y: 5.0 }, { x: 95.0, y: 95.0 }, 100.0, 100.0)
  assert_true((d - 200.0.sqrt()).abs() < 1.0e-10)
}

///|
test "normalize_angle boundary values unchanged" {
  assert_eq(normalize_angle(0.0), 0.0)
  assert_eq(normalize_angle(@math.PI), @math.PI)
  assert_eq(normalize_angle(-@math.PI), -@math.PI)
}

///|
test "normalize_angle wraps value just above pi" {
  let expected = 1.0 - @math.PI
  assert_true((normalize_angle(@math.PI + 1.0) - expected).abs() < 1.0e-10)
}

///|
test "normalize_angle wraps value just below negative pi" {
  let expected = @math.PI - 1.0
  assert_true((normalize_angle(-@math.PI - 1.0) - expected).abs() < 1.0e-10)
}

///|
test "normalize_angle wraps value requiring the loop to run (3*pi)" {
  let d = normalize_angle(3.0 * @math.PI)
  assert_true((d - @math.PI).abs() < 1.0e-10)
}
