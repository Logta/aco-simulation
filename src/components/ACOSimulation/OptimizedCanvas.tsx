import { useEffect, useRef, useCallback, memo } from 'react'
import { useSimulationStore } from '@/stores/simulation.store'
import type { Position } from '@/lib/aco/types'

type OptimizedCanvasProps = {
  width: number
  height: number
}

export const OptimizedCanvas = memo(({ width, height }: OptimizedCanvasProps) => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)
  const pheromoneCanvasRef = useRef<HTMLCanvasElement>(null)
  const frameCountRef = useRef(0)
  const lastPheromoneUpdateRef = useRef(0)
  
  const { ants, foods, pheromones, nest, addFood, isRunning } = useSimulationStore()

  // Background layer - static elements (nest)
  useEffect(() => {
    const canvas = bgCanvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    ctx.fillStyle = '#F5F5DC'
    ctx.fillRect(0, 0, width, height)
    
    // Draw nest
    ctx.fillStyle = '#8B4513'
    ctx.beginPath()
    ctx.arc(nest.x, nest.y, 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#654321'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [nest, width, height])

  // Pheromone layer - update less frequently
  useEffect(() => {
    if (!isRunning) return
    
    const canvas = pheromoneCanvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const updatePheromones = () => {
      frameCountRef.current++
      
      // Only update pheromones every 5 frames
      if (frameCountRef.current - lastPheromoneUpdateRef.current < 5) return
      
      lastPheromoneUpdateRef.current = frameCountRef.current
      ctx.clearRect(0, 0, width, height)
      
      // Use image data for batch rendering
      const imageData = ctx.createImageData(width, height)
      const data = imageData.data
      
      pheromones.forEach((pheromone) => {
        const x = Math.floor(pheromone.position.x)
        const y = Math.floor(pheromone.position.y)
        const intensity = Math.min(pheromone.intensity / 100, 0.5)
        
        for (let dx = -5; dx <= 5; dx++) {
          for (let dy = -5; dy <= 5; dy++) {
            const px = x + dx
            const py = y + dy
            
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const index = (py * width + px) * 4
              
              if (pheromone.type === 'toFood') {
                data[index + 1] = Math.max(data[index + 1], 255 * intensity) // Green
              } else {
                data[index + 2] = Math.max(data[index + 2], 255 * intensity) // Blue
              }
              data[index + 3] = Math.max(data[index + 3], 128 * intensity) // Alpha
            }
          }
        }
      })
      
      ctx.putImageData(imageData, 0, 0)
    }

    const interval = setInterval(updatePheromones, 100)
    return () => clearInterval(interval)
  }, [pheromones, width, height, isRunning])

  // Main layer - ants and food
  const drawMainLayer = useCallback(() => {
    const canvas = mainCanvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    
    // Batch draw foods
    ctx.fillStyle = '#FFA500'
    foods.forEach((food) => {
      const size = Math.max(3, food.amount / 10)
      ctx.beginPath()
      ctx.arc(food.position.x, food.position.y, size, 0, Math.PI * 2)
      ctx.fill()
    })
    
    // Batch draw ants
    ants.forEach((ant) => {
      ctx.fillStyle = ant.hasFood ? '#FF0000' : '#000000'
      ctx.beginPath()
      ctx.arc(ant.position.x, ant.position.y, 3, 0, Math.PI * 2)
      ctx.fill()
      
      // Direction indicator
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
  }, [ants, foods, width, height])

  // Animation loop
  useEffect(() => {
    if (!isRunning) return
    
    let animationId: number
    
    const animate = () => {
      drawMainLayer()
      animationId = requestAnimationFrame(animate)
    }
    
    animationId = requestAnimationFrame(animate)
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [isRunning, drawMainLayer])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = bgCanvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      addFood({ x, y })
    },
    [addFood]
  )

  return (
    <div 
      className="relative border border-gray-300 rounded-lg cursor-crosshair"
      style={{ width, height }}
      onClick={handleClick}
    >
      <canvas
        ref={bgCanvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0"
      />
      <canvas
        ref={pheromoneCanvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0"
      />
      <canvas
        ref={mainCanvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0"
      />
    </div>
  )
})

OptimizedCanvas.displayName = 'OptimizedCanvas'