import { describe, it, expect, beforeEach } from 'vitest'
import { executeAntBehavior } from './ant-behavior'
import type { Ant, Food, Pheromone, Position } from './types'

describe('executeAntBehavior', () => {
  let mockContext: {
    ant: Ant
    foods: Food[]
    pheromones: Map<string, Pheromone>
    nest: Position
    worldWidth: number
    worldHeight: number
    pheromoneDepositAmount: number
    pheromoneTrackingStrength: number
    ants: Ant[]
  }

  beforeEach(() => {
    mockContext = {
      ant: {
        id: 'ant1',
        position: { x: 100, y: 100 },
        direction: 0,
        hasFood: false,
        targetFood: null,
        foodAmount: null,
      },
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
      worldWidth: 800,
      worldHeight: 600,
      pheromoneDepositAmount: 2,
      pheromoneTrackingStrength: 0.7,
      ants: [],
    }
  })

  describe('Foraging behavior (no food)', () => {
    it('should move randomly when no food is nearby', () => {
      const result = executeAntBehavior(mockContext)

      expect(result.antUpdate?.position).toBeDefined()
      expect(result.antUpdate?.direction).toBeDefined()
      expect(result.pheromoneUpdates.size).toBe(0)
      expect(result.foodUpdate).toBeUndefined()
      expect(result.removeFood).toBeUndefined()
    })

    it('should approach food when nearby', () => {
      const nearbyFood: Food = {
        id: 'food1',
        position: { x: 115, y: 115 }, // Within detection range (20)
        amount: 10,
      }
      mockContext.foods = [nearbyFood]

      const result = executeAntBehavior(mockContext)

      expect(result.antUpdate?.position).toBeDefined()
      expect(result.pheromoneUpdates.size).toBe(0) // No pheromone when approaching
    })

    it('should collect food when close enough', () => {
      const closeFood: Food = {
        id: 'food1',
        position: { x: 105, y: 105 }, // Within collection range (10)
        amount: 10,
      }
      mockContext.foods = [closeFood]

      const result = executeAntBehavior(mockContext)

      expect(result.antUpdate).toMatchObject({
        hasFood: true,
        targetFood: 'food1',
        foodAmount: 10,
      })
      expect(result.foodUpdate).toEqual({ id: 'food1', amount: 9 })
      expect(result.pheromoneUpdates.size).toBe(0) // No pheromone when collecting
    })

    it('should remove food when amount becomes zero', () => {
      const lastFood: Food = {
        id: 'food1',
        position: { x: 105, y: 105 },
        amount: 1,
      }
      mockContext.foods = [lastFood]

      const result = executeAntBehavior(mockContext)

      expect(result.removeFood).toBe('food1')
      expect(result.foodUpdate).toBeUndefined()
    })
  })

  describe('Returning behavior (has food)', () => {
    beforeEach(() => {
      mockContext.ant = {
        ...mockContext.ant,
        hasFood: true,
        targetFood: 'food1',
        foodAmount: 10,
      }
    })

    it('should move towards nest when carrying food', () => {
      const result = executeAntBehavior(mockContext)

      expect(result.antUpdate?.position).toBeDefined()
      expect(result.antUpdate?.direction).toBeDefined()
      expect(result.pheromoneUpdates.size).toBeGreaterThan(0) // Should deposit pheromone
    })

    it('should deposit pheromone based on food amount', () => {
      // Test with high food amount
      mockContext.ant.foodAmount = 60
      
      const result = executeAntBehavior(mockContext)

      const pheromoneValues = Array.from(result.pheromoneUpdates.values())
      expect(pheromoneValues.length).toBeGreaterThan(0)
      
      // Should have higher intensity due to large food amount
      const intensity = pheromoneValues[0].intensity
      expect(intensity).toBeGreaterThan(mockContext.pheromoneDepositAmount)
    })

    it('should drop food when reaching nest', () => {
      mockContext.ant.position = { x: 395, y: 295 } // Close to nest

      const result = executeAntBehavior(mockContext)

      expect(result.antUpdate).toMatchObject({
        hasFood: false,
        targetFood: null,
        foodAmount: null,
      })
      expect(result.pheromoneUpdates.size).toBe(0) // No pheromone when dropping
    })

    it('should create toFood pheromone when returning', () => {
      const result = executeAntBehavior(mockContext)

      const pheromoneValues = Array.from(result.pheromoneUpdates.values())
      expect(pheromoneValues.length).toBeGreaterThan(0)
      expect(pheromoneValues[0].type).toBe('toFood')
    })
  })

  describe('Food quality multiplier', () => {
    beforeEach(() => {
      mockContext.ant = {
        ...mockContext.ant,
        hasFood: true,
        targetFood: 'food1',
        foodAmount: 30,
      }
    })

    it('should scale pheromone intensity with food amount', () => {
      // Test different food amounts
      const testCases = [
        { foodAmount: 10, expectedMultiplier: 1 + 10/30 },
        { foodAmount: 30, expectedMultiplier: 1 + 30/30 },
        { foodAmount: 60, expectedMultiplier: 1 + 2 }, // Capped at 3x total
      ]

      testCases.forEach(({ foodAmount, expectedMultiplier }) => {
        mockContext.ant.foodAmount = foodAmount
        
        const result = executeAntBehavior(mockContext)
        const pheromoneValues = Array.from(result.pheromoneUpdates.values())
        
        expect(pheromoneValues[0].intensity).toBeCloseTo(
          mockContext.pheromoneDepositAmount * expectedMultiplier,
          1
        )
      })
    })
  })

  describe('Pheromone following', () => {
    beforeEach(() => {
      // Add some pheromones to follow
      const mockPheromone: Pheromone = {
        position: { x: 150, y: 150 },
        intensity: 50,
        type: 'toFood',
      }
      mockContext.pheromones.set('15,15', mockPheromone)
    })

    it('should follow pheromone trails when exploring', () => {
      // The behavior is probabilistic, but we can test that the function runs
      const result = executeAntBehavior(mockContext)

      expect(result.antUpdate?.position).toBeDefined()
      expect(result.antUpdate?.direction).toBeDefined()
    })

    it('should not follow pheromones when carrying food', () => {
      mockContext.ant.hasFood = true
      mockContext.ant.foodAmount = 10
      
      const result = executeAntBehavior(mockContext)

      // Should move towards nest, not follow pheromones
      expect(result.antUpdate?.position).toBeDefined()
      expect(result.pheromoneUpdates.size).toBeGreaterThan(0)
    })
  })

  describe('Edge cases', () => {
    it('should handle ant at world boundaries', () => {
      mockContext.ant.position = { x: 0, y: 0 }
      
      const result = executeAntBehavior(mockContext)

      expect(result.antUpdate?.position).toBeDefined()
      expect(result.antUpdate?.position!.x).toBeGreaterThanOrEqual(0)
      expect(result.antUpdate?.position!.y).toBeGreaterThanOrEqual(0)
    })

    it('should handle null food amount', () => {
      mockContext.ant = {
        ...mockContext.ant,
        hasFood: true,
        foodAmount: null,
      }

      const result = executeAntBehavior(mockContext)

      // Should still work with default multiplier
      expect(result.pheromoneUpdates.size).toBeGreaterThan(0)
    })

    it('should handle empty pheromone map', () => {
      mockContext.pheromones.clear()
      
      const result = executeAntBehavior(mockContext)

      expect(result.antUpdate?.position).toBeDefined()
    })
  })
})