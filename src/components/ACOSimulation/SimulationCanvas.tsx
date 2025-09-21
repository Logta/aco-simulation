import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useSimulationStore } from '@/stores/simulation.store'
import type { Position } from '@/lib/aco/types'

type SimulationCanvasProps = {
  width: number
  height: number
}

export const SimulationCanvas = ({ width, height }: SimulationCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null)
  const offscreenCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null)
  const pheromoneCanvasRef = useRef<OffscreenCanvas | null>(null)
  const pheromoneCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null)
  const staticCanvasRef = useRef<OffscreenCanvas | null>(null)
  const staticCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null)
  const animationFrameRef = useRef<number>(0)
  const lastPheromoneUpdateRef = useRef<number>(0)
  
  const { ants, foods, pheromones, nest, addFood } = useSimulationStore()

  // オフスクリーンキャンバスの初期化（エラーハンドリング付き）
  useEffect(() => {
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        offscreenCanvasRef.current = new OffscreenCanvas(width, height)
        const offscreenCtx = offscreenCanvasRef.current.getContext('2d')
        
        if (!offscreenCtx) {
          throw new Error('オフスクリーンキャンバスの2Dコンテキストを取得できませんでした')
        }
        offscreenCtxRef.current = offscreenCtx
        
        pheromoneCanvasRef.current = new OffscreenCanvas(width, height)
        const pheromoneCtx = pheromoneCanvasRef.current.getContext('2d')
        
        if (!pheromoneCtx) {
          throw new Error('フェロモンキャンバスの2Dコンテキストを取得できませんでした')
        }
        pheromoneCtxRef.current = pheromoneCtx
      
        staticCanvasRef.current = new OffscreenCanvas(width, height)
        const staticCtx = staticCanvasRef.current.getContext('2d')
        
        if (!staticCtx) {
          throw new Error('静的キャンバスの2Dコンテキストを取得できませんでした')
        }
        staticCtxRef.current = staticCtx
      } else {
        console.warn('OffscreenCanvasがサポートされていません。フォールバック実装を使用します。')
      }
    } catch (error) {
      console.error('キャンバスの初期化中にエラーが発生しました:', error)
      // フォールバック: オフスクリーンキャンバスなしで動作
      offscreenCanvasRef.current = null
      offscreenCtxRef.current = null
      pheromoneCanvasRef.current = null
      pheromoneCtxRef.current = null
      staticCanvasRef.current = null
      staticCtxRef.current = null
    }
  }, [width, height])

  // Spatial indexing for pheromones
  const pheromoneGrid = useMemo(() => {
    const gridSize = 50
    const grid = new Map<string, Array<typeof pheromones extends Map<any, infer V> ? V : never>>()
    
    pheromones.forEach((pheromone) => {
      const gridX = Math.floor(pheromone.position.x / gridSize)
      const gridY = Math.floor(pheromone.position.y / gridSize)
      const key = `${gridX},${gridY}`
      
      if (!grid.has(key)) {
        grid.set(key, [])
      }
      grid.get(key)!.push(pheromone)
    })
    
    return grid
  }, [pheromones])

  const drawCircle = useCallback(
    (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
     position: Position,
     radius: number,
     color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(position.x, position.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  const drawPheromones = useCallback((ctx: OffscreenCanvasRenderingContext2D) => {
    const now = performance.now()
    
    // Only update pheromone layer every 100ms
    if (now - lastPheromoneUpdateRef.current < 100) {
      return false
    }
    lastPheromoneUpdateRef.current = now
    
    ctx.clearRect(0, 0, width, height)
    
    // Use pre-sorted pheromones from spatial index
    pheromoneGrid.forEach((pheromonesInCell) => {
      // Sort by intensity within each cell
      const sorted = pheromonesInCell.sort((a, b) => a.intensity - b.intensity)
      
      sorted.forEach((pheromone) => {
        const intensity = Math.min(pheromone.intensity / 100, 1)
        if (intensity < 0.05) return
        
        const radius = 12 + intensity * 15
        
        // Use simpler rendering for better performance
        ctx.globalAlpha = intensity
        if (pheromone.type === 'toFood') {
          ctx.fillStyle = '#00ff00'
        } else {
          ctx.fillStyle = '#0096ff'
        }
        
        ctx.beginPath()
        ctx.arc(pheromone.position.x, pheromone.position.y, radius, 0, Math.PI * 2)
        ctx.fill()
      })
    })
    
    ctx.globalAlpha = 1
    return true
  }, [pheromoneGrid, width, height])

  const drawFoods = useCallback((ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
    // Batch render all foods with same color
    ctx.fillStyle = '#FFA500'
    foods.forEach((food) => {
      const size = Math.max(3, food.amount / 10)
      ctx.beginPath()
      ctx.arc(food.position.x, food.position.y, size, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [foods])

  const drawAnts = useCallback((ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
    // Batch render ants by state
    const antsWithFood = ants.filter(ant => ant.hasFood)
    const antsWithoutFood = ants.filter(ant => !ant.hasFood)
    
    // Draw ants without food
    ctx.fillStyle = '#FFFFFF'
    antsWithoutFood.forEach((ant) => {
      ctx.beginPath()
      ctx.arc(ant.position.x, ant.position.y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
    
    // Draw ants with food
    ctx.fillStyle = '#FF6B6B'
    antsWithFood.forEach((ant) => {
      ctx.beginPath()
      ctx.arc(ant.position.x, ant.position.y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
    
    // Draw ant directions
    ctx.strokeStyle = '#CCCCCC'
    ctx.lineWidth = 1
    ctx.beginPath()
    ants.forEach((ant) => {
      ctx.moveTo(ant.position.x, ant.position.y)
      ctx.lineTo(
        ant.position.x + Math.cos(ant.direction) * 8,
        ant.position.y + Math.sin(ant.direction) * 8
      )
    })
    ctx.stroke()
  }, [ants])

  const drawNest = useCallback((ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
    drawCircle(ctx, nest, 15, '#D2691E')
    ctx.strokeStyle = '#FF8C00'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(nest.x, nest.y, 15, 0, Math.PI * 2)
    ctx.stroke()
  }, [nest, drawCircle])

  const drawStatic = useCallback(() => {
    const ctx = staticCtxRef.current
    if (!ctx) return
    
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(0, 0, width, height)
    drawNest(ctx)
  }, [width, height, drawNest])

  // Draw static elements once
  useEffect(() => {
    drawStatic()
  }, [drawStatic])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const mainCtx = canvas?.getContext('2d')
    const offscreenCtx = offscreenCtxRef.current
    const pheromoneCtx = pheromoneCtxRef.current
    const staticCtx = staticCtxRef.current
    
    if (!canvas || !mainCtx) return
    
    // Use offscreen canvas if available
    if (offscreenCtx && pheromoneCtx && staticCtx) {
      // Clear offscreen canvas
      offscreenCtx.clearRect(0, 0, width, height)
      
      // Draw static background
      offscreenCtx.drawImage(staticCanvasRef.current!, 0, 0)
      
      // Update and draw pheromones (cached)
      if (drawPheromones(pheromoneCtx)) {
        // Only redraw if updated
        offscreenCtx.globalAlpha = 0.7
        offscreenCtx.drawImage(pheromoneCanvasRef.current!, 0, 0)
        offscreenCtx.globalAlpha = 1
      } else {
        // Use cached pheromone layer
        offscreenCtx.globalAlpha = 0.7
        offscreenCtx.drawImage(pheromoneCanvasRef.current!, 0, 0)
        offscreenCtx.globalAlpha = 1
      }
      
      // Draw dynamic elements
      drawFoods(offscreenCtx)
      drawAnts(offscreenCtx)
      
      // Copy to main canvas
      mainCtx.clearRect(0, 0, width, height)
      mainCtx.drawImage(offscreenCanvasRef.current!, 0, 0)
    } else {
      // Fallback for browsers without OffscreenCanvas
      mainCtx.clearRect(0, 0, width, height)
      mainCtx.fillStyle = '#2a2a2a'
      mainCtx.fillRect(0, 0, width, height)
      
      // Draw all elements directly
      pheromoneGrid.forEach((pheromonesInCell) => {
        pheromonesInCell.forEach((pheromone) => {
          const intensity = Math.min(pheromone.intensity / 100, 1)
          if (intensity < 0.05) return
          
          const radius = 12 + intensity * 15
          mainCtx.globalAlpha = intensity * 0.7
          mainCtx.fillStyle = pheromone.type === 'toFood' ? '#00ff00' : '#0096ff'
          mainCtx.beginPath()
          mainCtx.arc(pheromone.position.x, pheromone.position.y, radius, 0, Math.PI * 2)
          mainCtx.fill()
        })
      })
      mainCtx.globalAlpha = 1
      
      drawNest(mainCtx)
      drawFoods(mainCtx)
      drawAnts(mainCtx)
    }
    
    animationFrameRef.current = requestAnimationFrame(render)
  }, [width, height, drawPheromones, drawNest, drawFoods, drawAnts, pheromoneGrid])

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(render)
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [render])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      addFood({ x, y })
    },
    [addFood]
  )

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-300 rounded-lg cursor-crosshair"
      onClick={handleClick}
    />
  )
}