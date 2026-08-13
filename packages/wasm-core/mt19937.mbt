///|
let mt19937_n : Int = 624

///|
let mt19937_m : Int = 397

///|
let mt19937_matrix_a : UInt = 0x9908b0df

///|
let mt19937_upper_mask : UInt = 0x80000000

///|
let mt19937_lower_mask : UInt = 0x7fffffff

///|
pub(all) struct Rng {
  state : FixedArray[UInt]
  mut index : Int
}

///|
/// 標準的なMT19937の初期化式で内部状態を埋める。
pub fn rng_new(seed : UInt) -> Rng {
  let state = FixedArray::make(mt19937_n, 0U)
  state[0] = seed
  for i in 1..<mt19937_n {
    let prev = state[i - 1]
    state[i] = 1812433253U * (prev ^ (prev >> 30)) + i.reinterpret_as_uint()
  }
  { state, index: mt19937_n }
}

///|
fn rng_generate(rng : Rng) -> Unit {
  for i in 0..<mt19937_n {
    let y = (rng.state[i] & mt19937_upper_mask) |
      (rng.state[(i + 1) % mt19937_n] & mt19937_lower_mask)
    let mut next = rng.state[(i + mt19937_m) % mt19937_n] ^ (y >> 1)
    if y % 2U != 0U {
      next = next ^ mt19937_matrix_a
    }
    rng.state[i] = next
  }
  rng.index = 0
}

///|
/// 次の32bit乱数を取得し、内部状態を1つ進める。
pub fn rng_next_uint(rng : Rng) -> UInt {
  if rng.index >= mt19937_n {
    rng_generate(rng)
  }
  let mut y = rng.state[rng.index]
  y = y ^ (y >> 11)
  y = y ^ ((y << 7) & 0x9d2c5680)
  y = y ^ ((y << 15) & 0xefc60000)
  y = y ^ (y >> 18)
  rng.index += 1
  y
}

///|
/// `[0, 1)`の範囲のDouble乱数を取得する(`Math.random()`相当)。
pub fn rng_next_double(rng : Rng) -> Double {
  rng_next_uint(rng).to_uint64().to_double() / 4294967296.0
}
