import { createFileRoute } from '@tanstack/react-router'
import { ACOSimulation } from '@/components/ACOSimulation'

export const Route = createFileRoute('/')({
  component: ACOSimulation,
})