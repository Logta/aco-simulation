export type { Position } from "./wasm-types";
export { loadAdapter, loadAdapterFromBytes } from "./loader";
export type { SimulationInitConfig } from "./population";
export {
  initializeSimulation,
  reinitializeAnts,
  addFood,
  addRandomFoods,
  resetAll,
} from "./population";
export type { RenderView } from "./render";
export { getRenderView } from "./render";
export type { StepConfig } from "./step";
export { stepSimulation, decaySimulation } from "./step";
