///|
/// Spike: minimal exported functions to verify the wasm(非GC)ターゲットの
/// zero-copy線形メモリ相互運用(JS ⇔ FixedArray[Double])を確認する。
#export_name("add")
pub fn add(a : Int, b : Int) -> Int {
  a + b
}

///|
/// 戻り値はJSから見て生のi32ポインタになり、
/// `new Float64Array(memory.buffer, ptr, length)`でゼロコピーに読める。
#export_name("make_array")
pub fn make_array() -> FixedArray[Double] {
  [1.5, 2.5, 3.5, 4.5]
}

///|
/// JS側から取得したポインタをそのまま引数として渡せることを確認する。
#export_name("sum_array")
pub fn sum_array(arr : FixedArray[Double]) -> Double {
  let mut total = 0.0
  for v in arr {
    total += v
  }
  total
}
