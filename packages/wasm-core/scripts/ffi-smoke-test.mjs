#!/usr/bin/env node
//
// aco_core.wasm の FFI スモークテスト
// =====================================
//
// 実行方法(リポジトリルート / どのディレクトリからでも可):
//
//     cd moonbit/aco_core && moon build --target wasm && cd -
//     node moonbit/aco_core/scripts/ffi-smoke-test.mjs
//
// (.wasm のパスはこのスクリプトの位置を基準に解決するため、
//  カレントディレクトリに依存しない)
//
// 目的:
//   `moon test` は MoonBit 側から FixedArray をネイティブに構築できるため、
//   「JS から実際に呼べるか」を検証できない。wasm(非GC)ターゲットの
//   FixedArray は線形メモリ上の参照カウントオブジェクトであり、JS からは
//   エクスポートされたアロケータ(alloc_f64 / alloc_i32 / alloc_u8)経由でしか
//   確保できない。本スクリプトは
//     アロケータ → typed array ビューで書き込み → step() / decay() →
//     同一ビューで読み戻し
//   という実運用と同じ往復経路を Node.js だけで検証する。
//   将来 Plan B(React アプリへの組み込み)のアダプタ層の土台としても使う。
//
// 終了コード: すべて PASS なら 0、1つでも FAIL なら 1。CI に載せられる。

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = resolve(HERE, "../_build/wasm/debug/build/aco_core.wasm");

// --- テスト結果の記録 -------------------------------------------------------

let failures = 0;

/** @param {string} name @param {boolean} ok @param {string} [detail] */
function check(name, ok, detail = "") {
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
}

// --- シミュレーション定数(MoonBit 側の既定値と揃える) ---------------------

const WORLD_WIDTH = 800.0;
const WORLD_HEIGHT = 600.0;
const CELL_SIZE = 10.0; // pheromone.mbt の pheromone_cell_size
const GRID_WIDTH = WORLD_WIDTH / CELL_SIZE; // 80
const GRID_HEIGHT = WORLD_HEIGHT / CELL_SIZE; // 60
const GRID_CELLS = GRID_WIDTH * GRID_HEIGHT; // 4800
const NEST_X = 400.0;
const NEST_Y = 300.0;
const DEPOSIT_AMOUNT = 2.0;

/** row-major インデックス(pheromone.mbt の grid_index と同じ) */
const gridIndex = (gx, gy) => gy * GRID_WIDTH + gx;

// --- ロード -----------------------------------------------------------------

console.log(`wasm: ${WASM_PATH}`);
const bytes = readFileSync(WASM_PATH);
// import は不要(非GCターゲット、外部依存なし)。
const { instance } = await WebAssembly.instantiate(bytes, {});
const wasm = instance.exports;

const expectedExports = [
  "memory",
  "step",
  "decay",
  "rng_create",
  "alloc_f64",
  "alloc_i32",
  "alloc_u8",
];
const missing = expectedExports.filter((n) => !(n in wasm));
check(
  "wasm がロードでき、必要なエクスポートが揃っている",
  missing.length === 0,
  missing.length === 0
    ? Object.keys(wasm).sort().join(", ")
    : `missing: ${missing.join(", ")}`,
);
if (missing.length > 0) process.exit(1);

// --- アロケーションとビューの張り方 -----------------------------------------
//
// 重要: アロケータは線形メモリを grow させることがあり、grow は
// `memory.buffer` を detach する = 既存の typed array ビューを無効化する。
// そのため「先に必要な配列をすべて確保し、確保が終わってからビューを張る」。
// Plan B のアダプタ層も同じ順序を守ること(毎フレーム確保し直さない)。
//
// アロケータの戻り値は要素データの先頭を指す生の i32 ポインタで、
// ヘッダ分のオフセット調整は不要。

/** @type {{ptr: number, len: number, kind: "f64"|"i32"|"u8"}[]} */
const allocations = [];

const reserve = (kind, len) => {
  const ptr =
    kind === "f64"
      ? wasm.alloc_f64(len)
      : kind === "i32"
        ? wasm.alloc_i32(len)
        : wasm.alloc_u8(len);
  const handle = { ptr, len, kind };
  allocations.push(handle);
  return handle;
};

/** 確保済みハンドルに typed array ビューを張る(確保完了後に一度だけ呼ぶ) */
const viewOf = (handle) => {
  const { ptr, len, kind } = handle;
  const buf = wasm.memory.buffer;
  if (kind === "f64") return new Float64Array(buf, ptr, len);
  if (kind === "i32") return new Int32Array(buf, ptr, len);
  return new Uint8Array(buf, ptr, len);
};

/** typed array ビューから、MoonBit に渡すためのポインタを復元する */
const ptrOf = (view) => view.byteOffset;

// --- 確保フェーズ: このスクリプトが使う配列をすべてここで確保する -----------

const ANT_COUNT = 2;
const FOOD_COUNT = 1;

// シナリオ1(2匹のアリで step() を実走)
const h = {
  antX: reserve("f64", ANT_COUNT),
  antY: reserve("f64", ANT_COUNT),
  antDirection: reserve("f64", ANT_COUNT),
  antHasFood: reserve("u8", ANT_COUNT),
  antTargetFoodIndex: reserve("i32", ANT_COUNT),
  antFoodAmount: reserve("f64", ANT_COUNT),
  foodX: reserve("f64", FOOD_COUNT),
  foodY: reserve("f64", FOOD_COUNT),
  foodAmount: reserve("f64", FOOD_COUNT),
  pheromoneToFood: reserve("f64", GRID_CELLS),
  pheromoneToNest: reserve("f64", GRID_CELLS),
  probeA: reserve("f64", GRID_CELLS),
  probeB: reserve("f64", GRID_CELLS),
};

// シナリオ2(トーラス境界検出)の2回分。フェロモン有り / 無しで2セット。
const wrapSets = [0, 1].map(() => ({
  x: reserve("f64", 1),
  y: reserve("f64", 1),
  direction: reserve("f64", 1),
  hasFood: reserve("u8", 1),
  targetIdx: reserve("i32", 1),
  carried: reserve("f64", 1),
  foodX: reserve("f64", 1),
  foodY: reserve("f64", 1),
  foodAmount: reserve("f64", 1),
  toFood: reserve("f64", GRID_CELLS),
  toNest: reserve("f64", GRID_CELLS),
}));

check(
  "alloc_f64 / alloc_i32 / alloc_u8 が有効なポインタを返す",
  allocations.every((a) => a.ptr > 0),
  `${allocations.length} 個の配列を確保 (grid ${GRID_WIDTH}x${GRID_HEIGHT} = ${GRID_CELLS} セル)`,
);

// --- ビュー生成フェーズ: 以降 grow は起こらないので、このビューを使い回す ---

const map = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, viewOf(v)]));
const v = map(h);
const wrap = wrapSets.map(map);
const bufferAtStart = wasm.memory.buffer;

// ===========================================================================
// Check 1: ビュー経由の書き込みが WASM 側に見えている(オフセット整合)
// ===========================================================================
//
// 22引数の step() をデバッグする前に、「JS のビューのオフセットが MoonBit の
// 要素レイアウトと一致しているか」を単独で確定させる。ここがズレていると
// 以降の失敗が何に起因するのか判別できなくなる。

v.probeA[42] = 50.0;
// decay_rate 0.999 なら 50.0 は 0 にならず、わずかに減るだけ
// (0 になると「そもそも書けていない」場合と区別できない)。
wasm.decay(ptrOf(v.probeA), ptrOf(v.probeB), 0.999);
check(
  "JS が書いた値を WASM 側が読めている(オフセット整合)",
  v.probeA[42] > 49.0 && v.probeA[42] < 50.0,
  `probe[42]: 50.0 -> ${v.probeA[42]}`,
);

// ===========================================================================
// Check 2-5: 2匹のアリで step() を実走させる
// ===========================================================================
//
// 2匹とも「食料を持って巣に帰る」状態にする。帰巣中のアリは移動しつつ
// 移動「前」の位置に toFood フェロモンを付与するため、1回の step() で
//   - アリ配列の in-place 更新
//   - 同一セルへの複数アリのフェロモン加算(裁定済みの MoonBit 仕様)
// の両方を一度に検証できる。
// (101,101) と (108,108) はどちらもセル (10,10) に入り、かつ距離 ~9.9 で
// 衝突回避半径 6.0 より離れているため、回避の縮退計算に落ちない。

const SHARED_CELL = gridIndex(10, 10);

v.antX.set([101.0, 108.0]);
v.antY.set([101.0, 108.0]);
v.antDirection.set([0.0, 0.0]);
v.antHasFood.set([1, 1]);
v.antTargetFoodIndex.set([-1, -1]);
// food_amount 0.0 -> food_quality_multiplier が厳密に 1.0 になる
v.antFoodAmount.set([0.0, 0.0]);

v.foodX.set([400.0]);
v.foodY.set([100.0]);
v.foodAmount.set([30.0]);

const before = {
  x: Array.from(v.antX),
  y: Array.from(v.antY),
  direction: Array.from(v.antDirection),
};

const rng = wasm.rng_create(1);
check("rng_create がハンドルを返す", rng > 0, `rng=${rng}`);

let stepThrew = null;
try {
  // 引数順は step.mbt の定義そのまま(22引数)。
  wasm.step(
    rng, // 1  rng
    ptrOf(v.antX), // 2  ant_x
    ptrOf(v.antY), // 3  ant_y
    ptrOf(v.antDirection), // 4  ant_direction
    ptrOf(v.antHasFood), // 5  ant_has_food
    ptrOf(v.antTargetFoodIndex), // 6  ant_target_food_index
    ptrOf(v.antFoodAmount), // 7  ant_food_amount
    ANT_COUNT, // 8  ant_count
    ptrOf(v.foodX), // 9  food_x
    ptrOf(v.foodY), // 10 food_y
    ptrOf(v.foodAmount), // 11 food_amount
    FOOD_COUNT, // 12 food_count
    ptrOf(v.pheromoneToFood), // 13 pheromone_to_food
    ptrOf(v.pheromoneToNest), // 14 pheromone_to_nest
    GRID_WIDTH, // 15 grid_width
    GRID_HEIGHT, // 16 grid_height
    NEST_X, // 17 nest_x
    NEST_Y, // 18 nest_y
    WORLD_WIDTH, // 19 world_width
    WORLD_HEIGHT, // 20 world_height
    DEPOSIT_AMOUNT, // 21 pheromone_deposit_amount
    0.7, // 22 pheromone_tracking_strength
  );
} catch (e) {
  stepThrew = e;
}
check(
  "step() が trap せず完走する",
  stepThrew === null,
  stepThrew ? String(stepThrew) : `22引数 / アリ ${ANT_COUNT} 匹 / 食料 ${FOOD_COUNT} 個`,
);
if (stepThrew) process.exit(1);

// step() 中に線形メモリが grow していれば buffer は detach され、
// 既存ビューは無効になる。ゼロコピー前提が成り立つことを明示的に確認する。
check(
  "step() が線形メモリを grow させずビューが有効なまま",
  wasm.memory.buffer === bufferAtStart && v.antX.length === ANT_COUNT,
  "memory.buffer は detach されていない",
);

// ビューを張り直さずに読める = in-place 更新が JS から見えている証拠
const moved = [0, 1].every((i) => v.antX[i] !== before.x[i] || v.antY[i] !== before.y[i]);
check(
  "アリの位置が in-place で更新されている(同一ビューで観測)",
  moved,
  [0, 1]
    .map(
      (i) =>
        `ant${i} (${before.x[i]}, ${before.y[i]}) -> (${v.antX[i].toFixed(4)}, ${v.antY[i].toFixed(4)})`,
    )
    .join(" / "),
);
console.log(
  `       direction: [${before.direction.join(", ")}] -> [${Array.from(v.antDirection)
    .map((d) => d.toFixed(4))
    .join(", ")}]`,
);

// 帰巣中のアリ2匹は移動「前」の位置(どちらもセル (10,10))に付与するため、
// 1フレームで 2.0 * 2 = 4.0 が積み上がる(last-write-wins ではない)。
const depositedCell = v.pheromoneToFood[SHARED_CELL];
check(
  "同一セルへの複数アリのフェロモン付与が加算される",
  Math.abs(depositedCell - DEPOSIT_AMOUNT * ANT_COUNT) < 1e-9,
  `cell(10,10) = ${depositedCell} (期待 ${DEPOSIT_AMOUNT * ANT_COUNT})`,
);

// ===========================================================================
// Check 6: decay() が既存のフェロモンを減衰させる
// ===========================================================================

const beforeDecay = v.pheromoneToFood[SHARED_CELL];
wasm.decay(ptrOf(v.pheromoneToFood), ptrOf(v.pheromoneToNest), 0.999);
const afterDecay = v.pheromoneToFood[SHARED_CELL];
check(
  "decay() が非ゼロセルを減少させる",
  beforeDecay > 0 && afterDecay < beforeDecay,
  `cell(10,10) = ${beforeDecay} -> ${afterDecay}`,
);

// ===========================================================================
// Check 7: トーラス境界をまたいだフェロモン検出を FFI 経由で検証
// ===========================================================================
//
// 世界の東端(セル (79,30) = 中心 (795,305))にフェロモンを置き、
// 西端 (2,305) のアリを方向 3π/4 で探索させる。
// アリの右センサー(direction + π/4 = π)は (-18,305) -> ラップ後 (782,305) に
// 落ち、フェロモンまでのトーラス距離は 13.0(検出半径 30.0 の内側)。
// 直線距離では 793.0 なので、ラップ非対応の実装では絶対に検出できない。
//
// 探索経路には乱数ジッタが入るため、絶対値ではなく
// 「同一シードでフェロモン有り / 無しを走らせて結果が変わるか」で判定する。
// ラップ非対応なら両者は完全に一致する。

const EDGE_PHEROMONE_CELL = gridIndex(79, 30);

/** @param {typeof wrap[0]} s @param {boolean} withPheromone */
const runExploration = (s, withPheromone) => {
  s.x[0] = 2.0;
  s.y[0] = 305.0;
  s.direction[0] = (3.0 * Math.PI) / 4.0;
  s.hasFood[0] = 0;
  s.targetIdx[0] = -1;
  s.carried[0] = -1.0;
  // 食料は探索範囲(food_detection_range = 20.0)の外に置き、
  // 確実に execute_exploration 経路へ入れる。
  s.foodX[0] = 400.0;
  s.foodY[0] = 100.0;
  s.foodAmount[0] = 30.0;
  if (withPheromone) s.toFood[EDGE_PHEROMONE_CELL] = 100.0;

  // 毎回同じシードの Rng を作るので、フェロモンの有無以外は完全に同条件。
  const r = wasm.rng_create(42);
  wasm.step(
    r,
    ptrOf(s.x),
    ptrOf(s.y),
    ptrOf(s.direction),
    ptrOf(s.hasFood),
    ptrOf(s.targetIdx),
    ptrOf(s.carried),
    1,
    ptrOf(s.foodX),
    ptrOf(s.foodY),
    ptrOf(s.foodAmount),
    1,
    ptrOf(s.toFood),
    ptrOf(s.toNest),
    GRID_WIDTH,
    GRID_HEIGHT,
    NEST_X,
    NEST_Y,
    WORLD_WIDTH,
    WORLD_HEIGHT,
    DEPOSIT_AMOUNT,
    1.0, // pheromone_tracking_strength: 常に追従判定を通す
  );
  return { x: s.x[0], y: s.y[0], direction: s.direction[0] };
};

const withoutP = runExploration(wrap[0], false);
const withP = runExploration(wrap[1], true);
const steered =
  withP.direction !== withoutP.direction || withP.x !== withoutP.x || withP.y !== withoutP.y;
check(
  "境界をまたいだフェロモンをセンサーが検出する(トーラス対応)",
  steered,
  `フェロモン無し dir=${withoutP.direction.toFixed(6)} / 有り dir=${withP.direction.toFixed(6)}`,
);

// --- まとめ -----------------------------------------------------------------

console.log("");
if (failures === 0) {
  console.log("すべてのチェックが PASS しました。");
  process.exit(0);
} else {
  console.log(`${failures} 件の FAIL があります。`);
  process.exit(1);
}
