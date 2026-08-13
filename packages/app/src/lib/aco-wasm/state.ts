import type { AdapterState } from "./wasm-types";

export const CELL_SIZE = 10;

let state: AdapterState | null = null;

export const getState = (): AdapterState => {
  if (!state) {
    throw new Error("adapter is not initialized: call loadAdapter() first");
  }
  return state;
};

export const setState = (newState: AdapterState): void => {
  state = newState;
};

export const f64 = (ptr: number, len: number): Float64Array =>
  new Float64Array(getState().wasm.memory.buffer, ptr, len);

export const u8 = (ptr: number, len: number): Uint8Array =>
  new Uint8Array(getState().wasm.memory.buffer, ptr, len);
