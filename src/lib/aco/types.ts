import { z } from 'zod'

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

export const FoodSchema = z.object({
  id: z.string(),
  position: PositionSchema,
  amount: z.number().positive(),
})

export const AntSchema = z.object({
  id: z.string(),
  position: PositionSchema,
  hasFood: z.boolean(),
  targetFood: z.string().nullable(),
  direction: z.number(),
})

export const PheromoneSchema = z.object({
  position: PositionSchema,
  intensity: z.number().min(0).max(100),
  type: z.enum(['toFood', 'toNest']),
})

export const SimulationConfigSchema = z.object({
  worldWidth: z.number().positive(),
  worldHeight: z.number().positive(),
  antCount: z.number().int().min(1).max(100),
  pheromoneDecayRate: z.number().min(0.9).max(1),
  pheromoneDepositAmount: z.number().min(0.1).max(10),
  speed: z.number().min(0.1).max(10),
})

export type Position = z.infer<typeof PositionSchema>
export type Food = z.infer<typeof FoodSchema>
export type Ant = z.infer<typeof AntSchema>
export type Pheromone = z.infer<typeof PheromoneSchema>
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>