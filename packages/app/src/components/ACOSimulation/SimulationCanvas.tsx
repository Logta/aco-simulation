import { useEffect, useRef, useCallback } from "react";
import { useSimulationStore } from "@/stores/simulation.store";
import { getRenderView } from "@/lib/aco-wasm/adapter";
import type { Position } from "@/lib/aco-wasm/adapter";

type SimulationCanvasProps = {
  width: number;
  height: number;
};

export const SimulationCanvas = ({ width, height }: SimulationCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null);
  const offscreenCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null);
  const pheromoneCanvasRef = useRef<OffscreenCanvas | null>(null);
  const pheromoneCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null);
  const staticCanvasRef = useRef<OffscreenCanvas | null>(null);
  const staticCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastPheromoneUpdateRef = useRef<number>(0);

  const { nest, addFood } = useSimulationStore();

  // オフスクリーンキャンバスの初期化（エラーハンドリング付き）
  useEffect(() => {
    try {
      if (typeof OffscreenCanvas !== "undefined") {
        offscreenCanvasRef.current = new OffscreenCanvas(width, height);
        const offscreenCtx = offscreenCanvasRef.current.getContext("2d");

        if (!offscreenCtx) {
          throw new Error("オフスクリーンキャンバスの2Dコンテキストを取得できませんでした");
        }
        offscreenCtxRef.current = offscreenCtx;

        pheromoneCanvasRef.current = new OffscreenCanvas(width, height);
        const pheromoneCtx = pheromoneCanvasRef.current.getContext("2d");

        if (!pheromoneCtx) {
          throw new Error("フェロモンキャンバスの2Dコンテキストを取得できませんでした");
        }
        pheromoneCtxRef.current = pheromoneCtx;

        staticCanvasRef.current = new OffscreenCanvas(width, height);
        const staticCtx = staticCanvasRef.current.getContext("2d");

        if (!staticCtx) {
          throw new Error("静的キャンバスの2Dコンテキストを取得できませんでした");
        }
        staticCtxRef.current = staticCtx;
      } else {
        console.warn("OffscreenCanvasがサポートされていません。フォールバック実装を使用します。");
      }
    } catch (error) {
      console.error("キャンバスの初期化中にエラーが発生しました:", error);
      offscreenCanvasRef.current = null;
      offscreenCtxRef.current = null;
      pheromoneCanvasRef.current = null;
      pheromoneCtxRef.current = null;
      staticCanvasRef.current = null;
      staticCtxRef.current = null;
    }
  }, [width, height]);

  const drawCircle = useCallback(
    (
      ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      position: Position,
      radius: number,
      color: string,
    ) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
      ctx.fill();
    },
    [],
  );

  const drawPheromoneGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      grid: Float64Array,
      gridWidth: number,
      cellSize: number,
      color: string,
      globalAlphaScale: number,
    ) => {
      for (let i = 0; i < grid.length; i++) {
        const raw = grid[i];
        if (raw <= 0) continue;
        const intensity = Math.min(raw / 100, 1);
        if (intensity < 0.05) continue;

        const gx = i % gridWidth;
        const gy = Math.floor(i / gridWidth);
        const cx = gx * cellSize + cellSize / 2;
        const cy = gy * cellSize + cellSize / 2;
        const radius = 12 + intensity * 15;

        ctx.globalAlpha = intensity * globalAlphaScale;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    [],
  );

  const drawPheromones = useCallback(
    (ctx: OffscreenCanvasRenderingContext2D, view: ReturnType<typeof getRenderView>) => {
      const now = performance.now();

      // フェロモン層は100msごとにのみ更新する
      if (now - lastPheromoneUpdateRef.current < 100) {
        return false;
      }
      lastPheromoneUpdateRef.current = now;

      ctx.clearRect(0, 0, width, height);
      drawPheromoneGrid(ctx, view.pheromoneToFood, view.gridWidth, view.cellSize, "#00ff00", 1);
      drawPheromoneGrid(ctx, view.pheromoneToNest, view.gridWidth, view.cellSize, "#0096ff", 1);

      return true;
    },
    [drawPheromoneGrid, width, height],
  );

  const drawFoods = useCallback(
    (
      ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      view: ReturnType<typeof getRenderView>,
    ) => {
      ctx.fillStyle = "#FFA500";
      for (let i = 0; i < view.foodCount; i++) {
        const size = Math.max(3, view.foodAmount[i] / 10);
        ctx.beginPath();
        ctx.arc(view.foodX[i], view.foodY[i], size, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [],
  );

  const drawAnts = useCallback(
    (
      ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      view: ReturnType<typeof getRenderView>,
    ) => {
      // hasFoodで色分けしつつ1パスで描画する
      for (let i = 0; i < view.antCount; i++) {
        ctx.fillStyle = view.antHasFood[i] === 1 ? "#FF6B6B" : "#FFFFFF";
        ctx.beginPath();
        ctx.arc(view.antX[i], view.antY[i], 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = "#CCCCCC";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < view.antCount; i++) {
        ctx.moveTo(view.antX[i], view.antY[i]);
        ctx.lineTo(
          view.antX[i] + Math.cos(view.antDirection[i]) * 8,
          view.antY[i] + Math.sin(view.antDirection[i]) * 8,
        );
      }
      ctx.stroke();
    },
    [],
  );

  const drawNest = useCallback(
    (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
      drawCircle(ctx, nest, 15, "#D2691E");
      ctx.strokeStyle = "#FF8C00";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(nest.x, nest.y, 15, 0, Math.PI * 2);
      ctx.stroke();
    },
    [nest, drawCircle],
  );

  const drawStatic = useCallback(() => {
    const ctx = staticCtxRef.current;
    if (!ctx) return;

    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, width, height);
    drawNest(ctx);
  }, [width, height, drawNest]);

  useEffect(() => {
    drawStatic();
  }, [drawStatic]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const mainCtx = canvas?.getContext("2d");
    const offscreenCtx = offscreenCtxRef.current;
    const pheromoneCtx = pheromoneCtxRef.current;
    const staticCtx = staticCtxRef.current;

    if (!canvas || !mainCtx) {
      animationFrameRef.current = requestAnimationFrame(render);
      return;
    }

    const view = getRenderView();

    if (offscreenCtx && pheromoneCtx && staticCtx) {
      offscreenCtx.clearRect(0, 0, width, height);
      offscreenCtx.drawImage(staticCanvasRef.current!, 0, 0);

      drawPheromones(pheromoneCtx, view);
      offscreenCtx.globalAlpha = 0.7;
      offscreenCtx.drawImage(pheromoneCanvasRef.current!, 0, 0);
      offscreenCtx.globalAlpha = 1;

      drawFoods(offscreenCtx, view);
      drawAnts(offscreenCtx, view);

      mainCtx.clearRect(0, 0, width, height);
      mainCtx.drawImage(offscreenCanvasRef.current!, 0, 0);
    } else {
      mainCtx.clearRect(0, 0, width, height);
      mainCtx.fillStyle = "#2a2a2a";
      mainCtx.fillRect(0, 0, width, height);

      drawPheromoneGrid(mainCtx, view.pheromoneToFood, view.gridWidth, view.cellSize, "#00ff00", 0.7);
      drawPheromoneGrid(mainCtx, view.pheromoneToNest, view.gridWidth, view.cellSize, "#0096ff", 0.7);

      drawNest(mainCtx);
      drawFoods(mainCtx, view);
      drawAnts(mainCtx, view);
    }

    animationFrameRef.current = requestAnimationFrame(render);
  }, [width, height, drawPheromones, drawPheromoneGrid, drawNest, drawFoods, drawAnts]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      addFood({ x, y });
    },
    [addFood],
  );

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-300 rounded-lg cursor-crosshair"
      onClick={handleClick}
    />
  );
};
