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
    // Sort pheromones by intensity to draw weaker ones first
    const sortedPheromones = Array.from(pheromones.values()).sort((a, b) => a.intensity - b.intensity)
    
    sortedPheromones.forEach((pheromone) => {
      const intensity = Math.min(pheromone.intensity / 100, 1)
      if (intensity < 0.05) return // Skip very weak pheromones
      
      const radius = 12 + intensity * 15
      
      // Create radial gradient for better visibility
      const gradient = ctx.createRadialGradient(
        pheromone.position.x, pheromone.position.y, 0,
        pheromone.position.x, pheromone.position.y, radius
      )
      
      if (pheromone.type === 'toFood') {
        // Bright green for food trail
        gradient.addColorStop(0, `rgba(0, 255, 0, ${intensity})`)
        gradient.addColorStop(0.3, `rgba(0, 220, 0, ${intensity * 0.6})`)
        gradient.addColorStop(0.6, `rgba(0, 180, 0, ${intensity * 0.3})`)
        gradient.addColorStop(1, 'rgba(0, 100, 0, 0)')
      } else {
        // Bright blue for nest trail
        gradient.addColorStop(0, `rgba(0, 150, 255, ${intensity})`)
        gradient.addColorStop(0.3, `rgba(0, 100, 220, ${intensity * 0.6})`)
        gradient.addColorStop(0.6, `rgba(0, 50, 180, ${intensity * 0.3})`)
        gradient.addColorStop(1, 'rgba(0, 0, 100, 0)')
      }
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(pheromone.position.x, pheromone.position.y, radius, 0, Math.PI * 2)
      ctx.fill()
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
      drawCircle(ctx, ant.position, 3, ant.hasFood ? '#FF6B6B' : '#FFFFFF')
      
      ctx.strokeStyle = ant.hasFood ? '#FFB6B6' : '#CCCCCC'
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
    drawCircle(ctx, nest, 15, '#D2691E')
    ctx.strokeStyle = '#FF8C00'
    ctx.lineWidth = 3
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
    
    // Darker background for better pheromone visibility
    ctx.fillStyle = '#2a2a2a'
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