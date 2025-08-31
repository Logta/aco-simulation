import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSimulation } from './useSimulation'
import { useSimulationStore } from '@/stores/simulation.store'

vi.mock('@/stores/simulation.store')

describe('useSimulation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('should initialize animation frame when hook is mounted', () => {
    const mockStore = {
      isRunning: false,
      speed: 1,
      ants: [],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
      worldWidth: 800,
      worldHeight: 600,
      pheromoneDecayRate: 0.01,
      pheromoneDepositAmount: 100,
      updateAnt: vi.fn(),
      updatePheromone: vi.fn(),
      removeFood: vi.fn(),
      updateFood: vi.fn(),
    }

    vi.mocked(useSimulationStore).mockReturnValue(mockStore)

    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame')
    
    renderHook(() => useSimulation())
    
    expect(requestAnimationFrameSpy).toHaveBeenCalled()
  })

  it('should cancel animation frame on unmount', () => {
    const mockStore = {
      isRunning: false,
      speed: 1,
      ants: [],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
      worldWidth: 800,
      worldHeight: 600,
      pheromoneDecayRate: 0.01,
      pheromoneDepositAmount: 100,
      updateAnt: vi.fn(),
      updatePheromone: vi.fn(),
      removeFood: vi.fn(),
      updateFood: vi.fn(),
    }

    vi.mocked(useSimulationStore).mockReturnValue(mockStore)

    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame')
    
    const { unmount } = renderHook(() => useSimulation())
    
    unmount()
    
    expect(cancelAnimationFrameSpy).toHaveBeenCalled()
  })

  it('should update ants when simulation is running', () => {
    const mockAnt = {
      id: '1',
      position: { x: 100, y: 100 },
      direction: 0,
      hasFood: false,
      targetFood: null,
    }

    const mockFood = {
      id: 'food1',
      position: { x: 200, y: 200 },
      amount: 10,
    }

    const mockStore = {
      isRunning: true,
      speed: 1,
      ants: [mockAnt],
      foods: [mockFood],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
      worldWidth: 800,
      worldHeight: 600,
      pheromoneDecayRate: 0.01,
      pheromoneDepositAmount: 100,
      updateAnt: vi.fn(),
      updatePheromone: vi.fn(),
      removeFood: vi.fn(),
      updateFood: vi.fn(),
    }

    vi.mocked(useSimulationStore).mockReturnValue(mockStore)

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockStore.updateAnt).toHaveBeenCalled()
  })

  it('should make ant pick up food when close enough', () => {
    const mockAnt = {
      id: '1',
      position: { x: 195, y: 195 },
      direction: 0,
      hasFood: false,
      targetFood: null,
    }

    const mockFood = {
      id: 'food1',
      position: { x: 200, y: 200 },
      amount: 10,
    }

    const mockStore = {
      isRunning: true,
      speed: 1,
      ants: [mockAnt],
      foods: [mockFood],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
      worldWidth: 800,
      worldHeight: 600,
      pheromoneDecayRate: 0.01,
      pheromoneDepositAmount: 100,
      updateAnt: vi.fn(),
      updatePheromone: vi.fn(),
      removeFood: vi.fn(),
      updateFood: vi.fn(),
    }

    vi.mocked(useSimulationStore).mockReturnValue(mockStore)

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockStore.updateAnt).toHaveBeenCalledWith(
      mockAnt.id,
      expect.objectContaining({ hasFood: true })
    )
    expect(mockStore.updateFood).toHaveBeenCalledWith(
      mockFood.id,
      { amount: mockFood.amount - 1 }
    )
  })

  it('should remove food when amount reaches zero', () => {
    const mockAnt = {
      id: '1',
      position: { x: 195, y: 195 },
      direction: 0,
      hasFood: false,
      targetFood: null,
    }

    const mockFood = {
      id: 'food1',
      position: { x: 200, y: 200 },
      amount: 1,
    }

    const mockStore = {
      isRunning: true,
      speed: 1,
      ants: [mockAnt],
      foods: [mockFood],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
      worldWidth: 800,
      worldHeight: 600,
      pheromoneDecayRate: 0.01,
      pheromoneDepositAmount: 100,
      updateAnt: vi.fn(),
      updatePheromone: vi.fn(),
      removeFood: vi.fn(),
      updateFood: vi.fn(),
    }

    vi.mocked(useSimulationStore).mockReturnValue(mockStore)

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockStore.removeFood).toHaveBeenCalledWith(mockFood.id)
  })

  it('should deposit pheromones when ant has food', () => {
    const mockAnt = {
      id: '1',
      position: { x: 200, y: 200 },
      direction: 0,
      hasFood: true,
      targetFood: 'food1',
    }

    const mockStore = {
      isRunning: true,
      speed: 1,
      ants: [mockAnt],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
      worldWidth: 800,
      worldHeight: 600,
      pheromoneDecayRate: 0.01,
      pheromoneDepositAmount: 100,
      updateAnt: vi.fn(),
      updatePheromone: vi.fn(),
      removeFood: vi.fn(),
      updateFood: vi.fn(),
    }

    vi.mocked(useSimulationStore).mockReturnValue(mockStore)

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockStore.updatePheromone).toHaveBeenCalled()
  })

  it('should drop food when ant reaches nest', () => {
    const mockAnt = {
      id: '1',
      position: { x: 395, y: 295 },
      direction: 0,
      hasFood: true,
      targetFood: 'food1',
    }

    const mockStore = {
      isRunning: true,
      speed: 1,
      ants: [mockAnt],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
      worldWidth: 800,
      worldHeight: 600,
      pheromoneDecayRate: 0.01,
      pheromoneDepositAmount: 100,
      updateAnt: vi.fn(),
      updatePheromone: vi.fn(),
      removeFood: vi.fn(),
      updateFood: vi.fn(),
    }

    vi.mocked(useSimulationStore).mockReturnValue(mockStore)

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockStore.updateAnt).toHaveBeenCalledWith(
      mockAnt.id,
      expect.objectContaining({ hasFood: false, targetFood: null })
    )
  })

  it('should decay pheromones over time', () => {
    const mockPheromone = {
      position: { x: 100, y: 100 },
      type: 'toFood' as const,
      intensity: 100,
    }

    const pheromoneKey = '100,100'
    const pheromones = new Map([[pheromoneKey, mockPheromone]])

    const mockStore = {
      isRunning: true,
      speed: 1,
      ants: [],
      foods: [],
      pheromones,
      nest: { x: 400, y: 300 },
      worldWidth: 800,
      worldHeight: 600,
      pheromoneDecayRate: 0.1,
      pheromoneDepositAmount: 100,
      updateAnt: vi.fn(),
      updatePheromone: vi.fn(),
      removeFood: vi.fn(),
      updateFood: vi.fn(),
    }

    vi.mocked(useSimulationStore).mockReturnValue(mockStore)

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockStore.updatePheromone).toHaveBeenCalledWith(
      pheromoneKey,
      expect.objectContaining({ intensity: expect.any(Number) })
    )
  })
})