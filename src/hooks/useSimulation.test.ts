import { describe, it, expect } from 'bun:test'
import { useSimulation } from './useSimulation'

describe('useSimulation', () => {
  it('should export useSimulation function', () => {
    expect(typeof useSimulation).toBe('function')
  })
})