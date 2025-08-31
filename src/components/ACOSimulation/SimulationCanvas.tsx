import { useEffect, useRef, useCallback } from 'react'
import { useSimulationStore } from '@/stores/simulation.store'
import type { Position } from '@/lib/aco/types'

type SimulationCanvasProps = {
  width: number
  height: number
}

export const SimulationCanvas = ({ width, height }: SimulationCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { ants, foods, pheromones, nest, addFood } = useSimulationStore()

  const drawCircle = (
    ctx: CanvasRenderingContext2D,
    position: Position,
    radius: number,
    color: string
  ) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(position.x, position.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawPheromones = useCallback((ctx: CanvasRenderingContext2D) => {
    pheromones.forEach((pheromone) => {
      const alpha = Math.min(pheromone.intensity / 100, 0.5)
      ctx.fillStyle = pheromone.type === 'toFood' 
        ? `rgba(0, 255, 0, ${alpha})`
        : `rgba(0, 100, 255, ${alpha})`
      ctx.fillRect(
        pheromone.position.x - 5,
        pheromone.position.y - 5,
        10,
        10
      )
    })
  }, [pheromones])

  const drawFoods = useCallback((ctx: CanvasRenderingContext2D) => {
    foods.forEach((food) => {
      const size = Math.max(3, food.amount / 10)
      drawCircle(ctx, food.position, size, '#FFA500')
    })
  }, [foods])

  const drawAnts = useCallback((ctx: CanvasRenderingContext2D) => {
    ants.forEach((ant) => {
      drawCircle(ctx, ant.position, 3, ant.hasFood ? '#FF0000' : '#000000')
      
      ctx.strokeStyle = '#666666'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ant.position.x, ant.position.y)
      ctx.lineTo(
        ant.position.x + Math.cos(ant.direction) * 8,
        ant.position.y + Math.sin(ant.direction) * 8
      )
      ctx.stroke()
    })
  }, [ants])

  const drawNest = useCallback((ctx: CanvasRenderingContext2D) => {
    drawCircle(ctx, nest, 15, '#8B4513')
    ctx.strokeStyle = '#654321'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(nest.x, nest.y, 15, 0, Math.PI * 2)
    ctx.stroke()
  }, [nest])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    
    ctx.fillStyle = '#F5F5DC'
    ctx.fillRect(0, 0, width, height)

    drawPheromones(ctx)
    drawNest(ctx)
    drawFoods(ctx)
    drawAnts(ctx)
  }, [width, height, drawPheromones, drawNest, drawFoods, drawAnts])

  useEffect(() => {
    draw()
  }, [draw])

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