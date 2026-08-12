///|
pub(all) struct MovementResult {
  position : Position
  direction : Double
} derive(Eq, Debug)

///|
/// 目標に向かって直線移動する。speed未満に近づいたら目標座標をそのまま返す。
pub fn move_towards_target(
  position : Position,
  target : Position,
  world_width : Double,
  world_height : Double,
  speed : Double,
) -> Position {
  let dx = target.x - position.x
  let dy = target.y - position.y
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
  let distance = (wrapped_dx * wrapped_dx + wrapped_dy * wrapped_dy).sqrt()
  if distance < speed {
    target
  } else {
    let move_x = wrapped_dx / distance * speed
    let move_y = wrapped_dy / distance * speed
    torus_wrap(
      { x: position.x + move_x, y: position.y + move_y },
      world_width,
      world_height,
    )
  }
}

///|
/// ランダムウォーク付きの基本移動。
pub fn move_ant(
  rng : Rng,
  position : Position,
  direction : Double,
  world_width : Double,
  world_height : Double,
  speed : Double,
  random_turn_range : Double,
) -> MovementResult {
  let random_turn = (rng_next_double(rng) - 0.5) * random_turn_range
  let new_direction = direction + random_turn
  let new_position = torus_wrap(
    { x: position.x + @math.cos(new_direction) * speed, y: position.y + @math.sin(
        new_direction,
      ) * speed },
    world_width,
    world_height,
  )
  { position: new_position, direction: new_direction }
}

///|
/// 目標へのバイアス付き移動(ランダムウォークとのブレンド)。
pub fn move_with_bias(
  rng : Rng,
  position : Position,
  direction : Double,
  target : Position,
  world_width : Double,
  world_height : Double,
  speed : Double,
  random_turn_range : Double,
  bias_strength : Double,
) -> MovementResult {
  let dx = target.x - position.x
  let dy = target.y - position.y
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
  let target_direction = @math.atan2(wrapped_dy, wrapped_dx)
  let random_turn = (rng_next_double(rng) - 0.5) * random_turn_range
  let mut direction_to_target = target_direction - direction
  if direction_to_target > @math.PI {
    direction_to_target -= 2.0 * @math.PI
  } else if direction_to_target < -@math.PI {
    direction_to_target += 2.0 * @math.PI
  }
  let new_direction =
    direction + direction_to_target * bias_strength + random_turn * (1.0 - bias_strength)
  let new_position = torus_wrap(
    { x: position.x + @math.cos(new_direction) * speed, y: position.y + @math.sin(
        new_direction,
      ) * speed },
    world_width,
    world_height,
  )
  { position: new_position, direction: new_direction }
}
