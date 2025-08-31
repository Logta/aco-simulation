import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSimulation } from './useSimulation'
import { useSimulationStore } from '@/stores/simulation.store'

vi.mock('@/stores/simulation.store')

describe('useSimulation', () => {
  let mockSetState: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockSetState = vi.fn()
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

  it('should update state when simulation is running', () => {
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
    vi.mocked(useSimulationStore).setState = mockSetState

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockSetState).toHaveBeenCalled()
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
    vi.mocked(useSimulationStore).setState = mockSetState

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockSetState).toHaveBeenCalledWith(
      expect.any(Function)
    )
    
    // Call the setState function to verify the update
    const setStateCall = mockSetState.mock.calls[0][0]
    const result = setStateCall({
      ants: [mockAnt],
      foods: [mockFood],
      pheromones: new Map()
    })
    
    expect(result.ants[0]).toMatchObject({ hasFood: true })
    expect(result.foods[0].amount).toBe(9)
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
    vi.mocked(useSimulationStore).setState = mockSetState

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    const setStateCall = mockSetState.mock.calls[0][0]
    const result = setStateCall({
      ants: [mockAnt],
      foods: [mockFood],
      pheromones: new Map()
    })
    
    expect(result.foods).toHaveLength(0)
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
    vi.mocked(useSimulationStore).setState = mockSetState

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    const setStateCall = mockSetState.mock.calls[0][0]
    const result = setStateCall({
      ants: [mockAnt],
      foods: [],
      pheromones: new Map()
    })
    
    expect(result.pheromones.size).toBeGreaterThan(0)
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
    vi.mocked(useSimulationStore).setState = mockSetState

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    const setStateCall = mockSetState.mock.calls[0][0]
    const result = setStateCall({
      ants: [mockAnt],
      foods: [],
      pheromones: new Map()
    })
    
    expect(result.ants[0]).toMatchObject({ hasFood: false, targetFood: null })
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
      pheromoneDecayRate: 0.9,
      pheromoneDepositAmount: 100,
      updateAnt: vi.fn(),
      updatePheromone: vi.fn(),
      removeFood: vi.fn(),
      updateFood: vi.fn(),
    }

    vi.mocked(useSimulationStore).mockReturnValue(mockStore)
    vi.mocked(useSimulationStore).setState = mockSetState

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    const setStateCall = mockSetState.mock.calls[0][0]
    const result = setStateCall({
      ants: [],
      foods: [],
      pheromones
    })
    
    const decayedPheromone = result.pheromones.get(pheromoneKey)
    expect(decayedPheromone?.intensity).toBeLessThan(100)
  })

  it('should not update when simulation is not running', () => {
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
    vi.mocked(useSimulationStore).setState = mockSetState

    renderHook(() => useSimulation())

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockSetState).not.toHaveBeenCalled()
  })
})