///|
test "step moves a single foraging ant and mutates its array in place" {
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
  step(
    rng, ant_x, ant_y, ant_direction, ant_has_food, ant_target_food_index, ant_food_amount,
    1, food_x, food_y, food_amount, 0, pheromone_to_food, pheromone_to_nest, 80,
    60, 400.0, 300.0, 800.0, 600.0, 2.0, 0.7,
  )
  // moved away from the starting position (either x or y changed)
  assert_false(ant_x[0] == 100.0 && ant_y[0] == 100.0)
}

///|
test "decay reduces existing pheromones" {
  // NOTE: the brief's Step 1 originally wrote this test against `step()`,
  // matching an earlier design where step() decayed pheromones every frame.
  // Step 3's design (and its verbatim step() implementation) moved pheromone
  // decay out of step() into a separate `decay()` export, so interval control
  // can live in Plan B's JS adapter instead of running every frame. Running
  // the original test against step() fails as predicted (pheromone_to_food[42]
  // stays at 50.0, since a foraging ant with no food sources only reads
  // pheromone via follow_pheromone and never deposits/decays it). This test is
  // retargeted at the decay() export added in this same task, preserving the
  // original assertion's intent (decay lowers pheromone intensity) while
  // exercising it through the entrypoint this task defines.
  let pheromone_to_food = FixedArray::make(4800, 0.0)
  pheromone_to_food[42] = 50.0
  let pheromone_to_nest = FixedArray::make(4800, 0.0)
  decay(pheromone_to_food, pheromone_to_nest, 0.7)
  assert_true(pheromone_to_food[42] < 50.0)
}
