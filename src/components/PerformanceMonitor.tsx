import { useEffect, useState, useRef } from 'react'

type PerformanceStats = {
  fps: number
  frameTime: number
  memoryUsage: number
  renderTime: number
}

export const PerformanceMonitor = () => {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    renderTime: 0
  })
  
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const renderStartRef = useRef(0)
  
  useEffect(() => {
    const updateStats = () => {
      const now = performance.now()
      frameCountRef.current++
      
      const deltaTime = now - lastTimeRef.current
      
      if (deltaTime >= 1000) { // Update every second
        const fps = Math.round((frameCountRef.current * 1000) / deltaTime)
        const frameTime = deltaTime / frameCountRef.current
        
        // @ts-ignore - performance.memory might not be available in all browsers
        const memoryUsage = performance.memory ? 
          Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0
        
        const renderTime = now - renderStartRef.current
        
        setStats({
          fps,
          frameTime: Math.round(frameTime * 100) / 100,
          memoryUsage,
          renderTime: Math.round(renderTime * 100) / 100
        })
        
        frameCountRef.current = 0
        lastTimeRef.current = now
      }
      
      renderStartRef.current = performance.now()
      requestAnimationFrame(updateStats)
    }
    
    const animationId = requestAnimationFrame(updateStats)
    
    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [])
  
  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-75 text-white p-3 rounded font-mono text-sm">
      <div>FPS: {stats.fps}</div>
      <div>Frame: {stats.frameTime}ms</div>
      <div>Memory: {stats.memoryUsage}MB</div>
      <div>Render: {stats.renderTime}ms</div>
    </div>
  )
}