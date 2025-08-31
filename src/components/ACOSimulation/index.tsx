import { useEffect, useRef } from 'react'
import { useSimulationStore } from '@/stores/simulation.store'
import { OptimizedCanvas } from './OptimizedCanvas'
import { ControlPanel } from './ControlPanel'
import { PerformanceMonitor } from '@/components/PerformanceMonitor'
import { useOptimizedSimulation } from '@/hooks/useOptimizedSimulation'

export const ACOSimulation = () => {
  const { initializeSimulation, addRandomFoods } = useSimulationStore()
  const isInitialized = useRef(false)

  useOptimizedSimulation()

  useEffect(() => {
    if (!isInitialized.current) {
      initializeSimulation()
      addRandomFoods(10)
      isInitialized.current = true
    }
  }, [initializeSimulation, addRandomFoods])

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-gray-100">
      <div className="flex-1 flex items-center justify-center">
        <OptimizedCanvas width={800} height={600} />
      </div>
      <div className="w-full lg:w-96">
        <ControlPanel />
      </div>
      <PerformanceMonitor />
    </div>
  )
}