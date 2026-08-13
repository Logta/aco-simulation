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
test "step accumulates every ant's pheromone deposit onto the same cell" {
  // 帰巣中のアリ2匹を、どちらもセル(10,10)に入り、かつ衝突回避半径6.0より
  // 離れた位置((101,101)と(108,108)、距離約9.9)に置く。
  // フェロモンは移動「前」の位置に付与されるため、両方ともセル(10,10)に載る。
  //
  // 裁定済みの仕様: TS版は1フレーム内の同一セルへの付与が
  // last-write-wins(=2.0しか残らない)だが、これはTS側のバグと判断した。
  // MoonBit版は全アリ分を加算するため 2.0 * 2 = 4.0 になる。
  let rng = rng_new(1)
  let ant_x : FixedArray[Double] = [101.0, 108.0]
  let ant_y : FixedArray[Double] = [101.0, 108.0]
  let ant_direction : FixedArray[Double] = [0.0, 0.0]
  let ant_has_food : FixedArray[Byte] = [1, 1]
  let ant_target_food_index : FixedArray[Int] = [-1, -1]
  // food_amount 0.0 -> food_quality_multiplier が厳密に 1.0 になる
  let ant_food_amount : FixedArray[Double] = [0.0, 0.0]
  let food_x : FixedArray[Double] = []
  let food_y : FixedArray[Double] = []
  let food_amount : FixedArray[Double] = []
  let pheromone_to_food = FixedArray::make(4800, 0.0)
  let pheromone_to_nest = FixedArray::make(4800, 0.0)
  step(
    rng, ant_x, ant_y, ant_direction, ant_has_food, ant_target_food_index, ant_food_amount,
    2, food_x, food_y, food_amount, 0, pheromone_to_food, pheromone_to_nest, 80,
    60, 400.0, 300.0, 800.0, 600.0, 2.0, 0.7,
  )
  let shared_cell = grid_index(10, 10, 80)
  assert_eq(pheromone_to_food[shared_cell], 4.0)
  // 2匹とも巣(400,300)に向かって移動している
  assert_true(ant_x[0] > 101.0 && ant_y[0] > 101.0)
  assert_true(ant_x[1] > 108.0 && ant_y[1] > 108.0)
}

///|
test "step lets two ants draw from the same nearest food source" {
  // 食料0は(115,100)、食料1は(105,100)。どちらもアリ2匹の探知範囲
  // (food_detection_range = 20.0)の内側にあるが、近いのは常に食料1。
  //
  // 裁定済みの仕様: TS版は`array.find()`で配列順の最初の1件(=食料0)を
  // 選ぶが、これは意図的な設計ではないと判断した。MoonBit版は最近傍
  // (=食料1)を選ぶ。どちらのアリも食料1までの距離が採取範囲
  // (food_collection_range = 10.0)以内なので、同一フレームで2匹とも
  // 食料1から採取し、減算が積み上がって 30.0 -> 28.0 になる。
  // 配列順で選んでいれば食料0が減っているはずで、両者は明確に区別できる。
  let rng = rng_new(1)
  let ant_x : FixedArray[Double] = [100.0, 108.0]
  let ant_y : FixedArray[Double] = [100.0, 100.0]
  let ant_direction : FixedArray[Double] = [0.0, 0.0]
  let ant_has_food : FixedArray[Byte] = [0, 0]
  let ant_target_food_index : FixedArray[Int] = [-1, -1]
  let ant_food_amount : FixedArray[Double] = [-1.0, -1.0]
  let food_x : FixedArray[Double] = [115.0, 105.0]
  let food_y : FixedArray[Double] = [100.0, 100.0]
  let food_amount : FixedArray[Double] = [30.0, 30.0]
  let pheromone_to_food = FixedArray::make(4800, 0.0)
  let pheromone_to_nest = FixedArray::make(4800, 0.0)
  step(
    rng, ant_x, ant_y, ant_direction, ant_has_food, ant_target_food_index, ant_food_amount,
    2, food_x, food_y, food_amount, 2, pheromone_to_food, pheromone_to_nest, 80,
    60, 400.0, 300.0, 800.0, 600.0, 2.0, 0.7,
  )
  // 遠い方(配列順で先頭)の食料は手つかず
  assert_eq(food_amount[0], 30.0)
  // 近い方の食料から2匹分が減っている
  assert_eq(food_amount[1], 28.0)
  assert_eq(ant_has_food[0], 1)
  assert_eq(ant_has_food[1], 1)
  assert_eq(ant_target_food_index[0], 1)
  assert_eq(ant_target_food_index[1], 1)
}

///|
test "step runs foraging and returning ants together in one frame" {
  // 1フレームの中で採餌経路と帰巣経路の両方を通し、食料配列とフェロモン
  // グリッドが同時に更新されることを確認する。
  // アリ0: (100,100)の採餌アリ。最近傍の食料1(105,100)から採取する。
  // アリ1: (300,300)の帰巣アリ。巣(400,300)まで距離100なので到着はせず、
  //        移動前の位置=セル(30,30)にフェロモンを付与する。
  let rng = rng_new(1)
  let ant_x : FixedArray[Double] = [100.0, 300.0]
  let ant_y : FixedArray[Double] = [100.0, 300.0]
  let ant_direction : FixedArray[Double] = [0.0, 0.0]
  let ant_has_food : FixedArray[Byte] = [0, 1]
  let ant_target_food_index : FixedArray[Int] = [-1, -1]
  let ant_food_amount : FixedArray[Double] = [-1.0, 0.0]
  let food_x : FixedArray[Double] = [115.0, 105.0]
  let food_y : FixedArray[Double] = [100.0, 100.0]
  let food_amount : FixedArray[Double] = [30.0, 30.0]
  let pheromone_to_food = FixedArray::make(4800, 0.0)
  let pheromone_to_nest = FixedArray::make(4800, 0.0)
  step(
    rng, ant_x, ant_y, ant_direction, ant_has_food, ant_target_food_index, ant_food_amount,
    2, food_x, food_y, food_amount, 2, pheromone_to_food, pheromone_to_nest, 80,
    60, 400.0, 300.0, 800.0, 600.0, 2.0, 0.7,
  )
  // 採餌アリは最近傍の食料1から採取した
  assert_eq(food_amount[0], 30.0)
  assert_eq(food_amount[1], 29.0)
  assert_eq(ant_has_food[0], 1)
  // 帰巣アリは巣に向かって移動しつつ、移動前のセルにフェロモンを付与した
  assert_eq(pheromone_to_food[grid_index(30, 30, 80)], 2.0)
  assert_eq(ant_has_food[1], 1)
  assert_true(ant_x[1] > 300.0)
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
