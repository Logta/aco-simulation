///|
pub(all) struct CollisionResult {
  position : Position
  direction : Double
} derive(Eq, Debug)

///|
/// 他のアリとの衝突を回避する。`self_index`と一致する要素は自分自身として除外する。
pub fn avoid_collisions(
  position : Position,
  direction : Double,
  other_x : FixedArray[Double],
  other_y : FixedArray[Double],
  other_count : Int,
  self_index : Int,
  world_width : Double,
  world_height : Double,
  avoidance_radius : Double,
  avoidance_strength : Double,
) -> CollisionResult {
  let mut force_x = 0.0
  let mut force_y = 0.0
  let mut collision_count = 0
  for i in 0..<other_count {
    if i != self_index {
      let other_position = { x: other_x[i], y: other_y[i] }
      let distance = torus_distance(
        position, other_position, world_width, world_height,
      )
      if distance < avoidance_radius && distance > 0.0 {
        let dx = position.x - other_position.x
        let dy = position.y - other_position.y
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
        let weight = (avoidance_radius - distance) / avoidance_radius
        let length = (wrapped_dx * wrapped_dx + wrapped_dy * wrapped_dy).sqrt()
        if length > 0.0 {
          force_x += wrapped_dx / length * weight
          force_y += wrapped_dy / length * weight
          collision_count += 1
        }
      }
    }
  }
  if collision_count == 0 {
    { position, direction }
  } else {
    let avoidance_direction = @math.atan2(force_y, force_x)
    let final_strength = @cmp.minimum(
      collision_count.to_double() * avoidance_strength,
      1.0,
    )
    let direction_diff = normalize_angle(avoidance_direction - direction)
    let new_direction = direction + direction_diff * final_strength
    let adjustment_strength = final_strength * 0.5
    let new_position = torus_wrap(
      {
        x: position.x + force_x * adjustment_strength,
        y: position.y + force_y * adjustment_strength,
      },
      world_width,
      world_height,
    )
    { position: new_position, direction: new_direction }
  }
}
