///|
pub(all) struct Position {
  x : Double
  y : Double
} derive(Eq, Debug)

///|
/// トーラス世界での位置ラッピング。座標が世界の境界を超えた場合、反対側に移動する。
pub fn torus_wrap(
  position : Position,
  world_width : Double,
  world_height : Double,
) -> Position {
  {
    x: (position.x % world_width + world_width) % world_width,
    y: (position.y % world_height + world_height) % world_height,
  }
}

///|
/// トーラス世界での2点間の最短距離。
pub fn torus_distance(
  a : Position,
  b : Position,
  world_width : Double,
  world_height : Double,
) -> Double {
  let dx = (a.x - b.x).abs()
  let dy = (a.y - b.y).abs()
  let wrapped_dx = @cmp.minimum(dx, world_width - dx)
  let wrapped_dy = @cmp.minimum(dy, world_height - dy)
  (wrapped_dx * wrapped_dx + wrapped_dy * wrapped_dy).sqrt()
}

///|
/// 角度を(-π, π]の範囲に正規化する。
pub fn normalize_angle(angle : Double) -> Double {
  let mut normalized = angle
  while normalized > @math.PI {
    normalized -= 2.0 * @math.PI
  }
  while normalized < -@math.PI {
    normalized += 2.0 * @math.PI
  }
  normalized
}
