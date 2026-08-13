///|
test "same seed produces the same sequence" {
  let rng_a = rng_new(42)
  let rng_b = rng_new(42)
  for i in 0..<20 {
    assert_eq(rng_next_double(rng_a), rng_next_double(rng_b))
  }
}

///|
test "different seeds produce different sequences" {
  let rng_a = rng_new(1)
  let rng_b = rng_new(2)
  let a0 = rng_next_double(rng_a)
  let b0 = rng_next_double(rng_b)
  assert_false(a0 == b0)
}

///|
test "output stays within [0, 1)" {
  let rng = rng_new(123)
  for i in 0..<1000 {
    let v = rng_next_double(rng)
    assert_true(v >= 0.0)
    assert_true(v < 1.0)
  }
}

///|
test "sequence is not trivially constant" {
  let rng = rng_new(7)
  let first = rng_next_double(rng)
  let mut all_same = true
  for i in 0..<10 {
    if rng_next_double(rng) != first {
      all_same = false
    }
  }
  assert_false(all_same)
}
