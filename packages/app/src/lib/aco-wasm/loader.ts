import type { AdapterState, WasmExports } from "./wasm-types";
import { setState } from "./state";

const instantiate = async (bytes: ArrayBuffer): Promise<WasmExports> => {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports as unknown as WasmExports;
};

const instantiateStreamingFrom = async (response: Response): Promise<WasmExports> => {
  // 一部の静的ホスティングは.wasmを正しいMIMEタイプ(application/wasm)で配信せず、
  // instantiateStreamingが失敗することがある。streamingを試みる前にレスポンスを
  // clone()しておき、失敗時はボディ全体を読み込んでからinstantiateにフォールバックする
  // (streaming実行後はレスポンスボディが既に消費されている可能性があるため、
  // フォールバック用のcloneは必ずstreamingを試みる前に取得する)。
  const fallbackResponse = response.clone();
  try {
    const { instance } = await WebAssembly.instantiateStreaming(response, {});
    return instance.exports as unknown as WasmExports;
  } catch {
    const bytes = await fallbackResponse.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return instance.exports as unknown as WasmExports;
  }
};

/** 本番用: Viteが解決した`.wasm`のURLからロードする。 */
export const loadAdapter = async (wasmUrl: URL): Promise<void> => {
  const response = await fetch(wasmUrl);
  const wasm = await instantiateStreamingFrom(response);
  setState(createEmptyState(wasm));
};

/** テスト用: 既に読み込んだバイト列からロードする。 */
export const loadAdapterFromBytes = async (bytes: ArrayBuffer): Promise<void> => {
  const wasm = await instantiate(bytes);
  setState(createEmptyState(wasm));
};

const createEmptyState = (wasm: WasmExports): AdapterState => ({
  wasm,
  rngPtr: 0,
  antCount: 0,
  ant: { x: 0, y: 0, direction: 0, hasFood: 0, targetFoodIndex: 0, foodAmount: 0 },
  foodCount: 0,
  food: { x: 0, y: 0, amount: 0 },
  gridWidth: 0,
  gridHeight: 0,
  pheromone: { toFood: 0, toNest: 0 },
  worldWidth: 0,
  worldHeight: 0,
  nest: { x: 0, y: 0 },
});
