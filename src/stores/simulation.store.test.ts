import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSimulationStore } from './simulation.store'

describe('useSimulationStore', () => {
  beforeEach(() => {
    useSimulationStore.setState({
      ants: [],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
      isRunning: false,
      speed: 1,
      antCount: 50,
      pheromoneDecayRate: 0.99,
      pheromoneDepositAmount: 1,
      worldWidth: 800,
      worldHeight: 600,
    })
  })

  describe('initializeSimulation', () => {
    it('should create ants based on antCount', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.setAntCount(10)
        result.current.initializeSimulation()
      })
      
      expect(result.current.ants).toHaveLength(10)
      expect(result.current.ants[0]).toMatchObject({
        id: expect.stringContaining('ant-'),
        position: { x: 400, y: 300 },
        hasFood: false,
        targetFood: null,
        direction: expect.any(Number),
      })
    })

    it('should reset pheromones when initializing', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.updatePheromone('test', {
          position: { x: 100, y: 100 },
          type: 'toFood',
          intensity: 100,
        })
      })
      
      expect(result.current.pheromones.size).toBe(1)
      
      act(() => {
        result.current.initializeSimulation()
      })
      
      expect(result.current.pheromones.size).toBe(0)
    })
  })

  describe('toggleSimulation', () => {
    it('should toggle isRunning state', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      expect(result.current.isRunning).toBe(false)
      
      act(() => {
        result.current.toggleSimulation()
      })
      
      expect(result.current.isRunning).toBe(true)
      
      act(() => {
        result.current.toggleSimulation()
      })
      
      expect(result.current.isRunning).toBe(false)
    })
  })

  describe('setSpeed', () => {
    it('should update speed', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.setSpeed(2.5)
      })
      
      expect(result.current.speed).toBe(2.5)
    })
  })

  describe('setAntCount', () => {
    it('should update ant count and reinitialize simulation', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.setAntCount(25)
      })
      
      expect(result.current.antCount).toBe(25)
      expect(result.current.ants).toHaveLength(25)
    })
  })

  describe('food management', () => {
    it('should add food at specified position', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.addFood({ x: 100, y: 200 })
      })
      
      expect(result.current.foods).toHaveLength(1)
      expect(result.current.foods[0]).toMatchObject({
        id: expect.stringContaining('food-'),
        position: { x: 100, y: 200 },
        amount: 100,
      })
    })

    it('should remove food by id', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.addFood({ x: 100, y: 200 })
      })
      
      const foodId = result.current.foods[0].id
      
      act(() => {
        result.current.removeFood(foodId)
      })
      
      expect(result.current.foods).toHaveLength(0)
    })

    it('should update food properties', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.addFood({ x: 100, y: 200 })
      })
      
      const foodId = result.current.foods[0].id
      
      act(() => {
        result.current.updateFood(foodId, { amount: 50 })
      })
      
      expect(result.current.foods[0].amount).toBe(50)
    })

    it('should add multiple random foods', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.addRandomFoods(5)
      })
      
      expect(result.current.foods).toHaveLength(5)
      result.current.foods.forEach(food => {
        expect(food.position.x).toBeGreaterThanOrEqual(0)
        expect(food.position.x).toBeLessThanOrEqual(800)
        expect(food.position.y).toBeGreaterThanOrEqual(0)
        expect(food.position.y).toBeLessThanOrEqual(600)
        expect(food.amount).toBeGreaterThanOrEqual(50)
        expect(food.amount).toBeLessThanOrEqual(150)
      })
    })
  })

  describe('ant management', () => {
    it('should update ant properties', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.initializeSimulation()
      })
      
      const antId = result.current.ants[0].id
      
      act(() => {
        result.current.updateAnt(antId, {
          hasFood: true,
          position: { x: 200, y: 200 },
        })
      })
      
      const updatedAnt = result.current.ants.find(a => a.id === antId)
      expect(updatedAnt?.hasFood).toBe(true)
      expect(updatedAnt?.position).toEqual({ x: 200, y: 200 })
    })
  })

  describe('pheromone management', () => {
    it('should update pheromone', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      const pheromone = {
        position: { x: 100, y: 100 },
        type: 'toFood' as const,
        intensity: 100,
      }
      
      act(() => {
        result.current.updatePheromone('100,100', pheromone)
      })
      
      expect(result.current.pheromones.get('100,100')).toEqual(pheromone)
    })

    it('should decay pheromones', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.updatePheromone('100,100', {
          position: { x: 100, y: 100 },
          type: 'toFood',
          intensity: 100,
        })
        result.current.setPheromoneDecayRate(0.9)
      })
      
      act(() => {
        result.current.decayPheromones()
      })
      
      const decayedPheromone = result.current.pheromones.get('100,100')
      expect(decayedPheromone?.intensity).toBeCloseTo(90)
    })

    it('should remove pheromones below threshold', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.updatePheromone('100,100', {
          position: { x: 100, y: 100 },
          type: 'toFood',
          intensity: 0.01,
        })
        result.current.setPheromoneDecayRate(0.5)
      })
      
      act(() => {
        result.current.decayPheromones()
      })
      
      expect(result.current.pheromones.has('100,100')).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset all state and reinitialize', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.addFood({ x: 100, y: 100 })
        result.current.updatePheromone('test', {
          position: { x: 100, y: 100 },
          type: 'toFood',
          intensity: 100,
        })
        result.current.toggleSimulation()
      })
      
      expect(result.current.foods).toHaveLength(1)
      expect(result.current.pheromones.size).toBe(1)
      expect(result.current.isRunning).toBe(true)
      
      act(() => {
        result.current.reset()
      })
      
      expect(result.current.foods).toHaveLength(0)
      expect(result.current.pheromones.size).toBe(0)
      expect(result.current.isRunning).toBe(false)
      expect(result.current.ants).toHaveLength(50)
    })
  })

  describe('pheromone parameters', () => {
    it('should update pheromone decay rate', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.setPheromoneDecayRate(0.95)
      })
      
      expect(result.current.pheromoneDecayRate).toBe(0.95)
    })

    it('should update pheromone deposit amount', () => {
      const { result } = renderHook(() => useSimulationStore())
      
      act(() => {
        result.current.setPheromoneDepositAmount(5)
      })
      
      expect(result.current.pheromoneDepositAmount).toBe(5)
    })
  })
})