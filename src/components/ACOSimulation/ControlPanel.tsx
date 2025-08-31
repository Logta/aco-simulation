import { useSimulationStore } from '@/stores/simulation.store'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { PlayIcon, PauseIcon, RefreshCwIcon, PlusIcon } from 'lucide-react'

export const ControlPanel = () => {
  const {
    isRunning,
    speed,
    antCount,
    pheromoneDecayRate,
    pheromoneDepositAmount,
    toggleSimulation,
    setSpeed,
    setAntCount,
    setPheromoneDecayRate,
    setPheromoneDepositAmount,
    addRandomFoods,
    reset,
  } = useSimulationStore()

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-md">
      <div>
        <h2 className="text-xl font-bold mb-4">シミュレーション制御</h2>
        
        <div className="flex gap-2 mb-6">
          <Button
            onClick={toggleSimulation}
            variant={isRunning ? "secondary" : "default"}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <PauseIcon className="w-4 h-4" />
                一時停止
              </>
            ) : (
              <>
                <PlayIcon className="w-4 h-4" />
                開始
              </>
            )}
          </Button>
          
          <Button
            onClick={reset}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCwIcon className="w-4 h-4" />
            リセット
          </Button>
          
          <Button
            onClick={() => addRandomFoods(5)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            餌を追加
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="speed" className="flex justify-between mb-2">
            <span>速度</span>
            <span className="text-gray-600">{speed.toFixed(1)}x</span>
          </Label>
          <Slider
            id="speed"
            value={[speed]}
            onValueChange={(value) => setSpeed(value[0])}
            min={0.1}
            max={5}
            step={0.1}
          />
        </div>

        <div>
          <Label htmlFor="antCount" className="flex justify-between mb-2">
            <span>蟻の数</span>
            <span className="text-gray-600">{antCount}</span>
          </Label>
          <Slider
            id="antCount"
            value={[antCount]}
            onValueChange={(value) => setAntCount(value[0])}
            min={1}
            max={100}
            step={1}
          />
        </div>

        <div>
          <Label htmlFor="decayRate" className="flex justify-between mb-2">
            <span>フェロモン蒸発率</span>
            <span className="text-gray-600">{(pheromoneDecayRate * 100).toFixed(1)}%</span>
          </Label>
          <Slider
            id="decayRate"
            value={[pheromoneDecayRate]}
            onValueChange={(value) => setPheromoneDecayRate(value[0])}
            min={0.9}
            max={0.999}
            step={0.001}
          />
        </div>

        <div>
          <Label htmlFor="depositAmount" className="flex justify-between mb-2">
            <span>フェロモン放出量</span>
            <span className="text-gray-600">{pheromoneDepositAmount.toFixed(1)}</span>
          </Label>
          <Slider
            id="depositAmount"
            value={[pheromoneDepositAmount]}
            onValueChange={(value) => setPheromoneDepositAmount(value[0])}
            min={0.1}
            max={5}
            step={0.1}
          />
        </div>
      </div>
    </div>
  )
}