# ACOコア Phase 0: 既存TS実装のテスト強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MoonBit/WASM移行(spec: `docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md` のPhase 0)の前提として、`src/lib/aco/`配下のホットパス関数(geometry/movement/collision/pheromone/pathfinding)と`simulation-engine.ts`に網羅的な単体テストを追加し、`simulation-engine.ts`と`useSimulation.ts`の重複ロジックを一本化する。

**Architecture:** 既存実装はそのまま変更せず(バグと確信できるものがない限り)、現在の入出力を「特性(characterization)テスト」として固定する。乱数を含む関数は`randomTurnRange: 0`または`vi.spyOn(Math, "random")`で決定的にしてからテストする。最後に`useSimulation.ts`のインライン重複ロジックを`simulation-engine.ts`の`executeSimulationStep`/`executePheromoneDacay`呼び出しに置き換える。

**Tech Stack:** TypeScript, Vitest(`describe`/`it`/`expect`/`vi`), 既存の`src/lib/aco/*`関数群。

## Global Constraints

- テストランナーの記法は`vitest`に統一する(`import { ... } from "vitest"`)。`bun:test`は使わない — `src/hooks/useSimulation.test.ts`の既存の`bun:test` importがこの規約に違反しており、Task 7で修正する
- 既存の公開関数のシグネチャ・実装は変更しない(Task 7の`useSimulation.ts`の呼び出し方変更を除く)。これは特性テストであり、新機能追加ではない
- テストファイルはソースファイルと同じディレクトリに`*.test.ts`として配置する(既存の`ant-behavior.test.ts`と同じ規約)
- 乱数(`Math.random()`)に依存する関数のテストは、可能な限り`randomTurnRange: 0`を渡して乱数の影響そのものを消し、乱数の影響を検証したいテストに限り`vi.spyOn(Math, "random")`でモックする
- 各タスクの完了条件は「新規/修正したテストファイルが`bun run test`(vitest)でPASSすること」。Task 8で全体の最終確認を行う

---

### Task 1: `geometry.ts`のテスト

**Files:**
- Create: `src/lib/aco/geometry.test.ts`

**Interfaces:**
- Consumes: `src/lib/aco/geometry.ts`の`torusWrap(position, worldWidth, worldHeight): Position`、`torusDistance(a, b, worldWidth, worldHeight): number`、`normalizeAngle(angle): number`(いずれも既存・変更なし)
- Produces: `geometry.test.ts`(他タスクからは参照されない、独立したテストファイル)

- [ ] **Step 1: テストファイルを作成する**

```typescript
// src/lib/aco/geometry.test.ts
import { describe, it, expect } from "vitest";
import { torusWrap, torusDistance, normalizeAngle } from "./geometry";

describe("torusWrap", () => {
  it("returns the position unchanged when within bounds", () => {
    expect(torusWrap({ x: 50, y: 30 }, 100, 100)).toEqual({ x: 50, y: 30 });
  });

  it("wraps a position exactly at the boundary to zero", () => {
    expect(torusWrap({ x: 100, y: 100 }, 100, 100)).toEqual({ x: 0, y: 0 });
  });

  it("wraps a negative position to the positive side", () => {
    expect(torusWrap({ x: -10, y: -5 }, 100, 50)).toEqual({ x: 90, y: 45 });
  });

  it("wraps a position that exceeds the world size multiple times", () => {
    expect(torusWrap({ x: 250, y: 130 }, 100, 50)).toEqual({ x: 50, y: 30 });
  });
});

describe("torusDistance", () => {
  it("computes the direct euclidean distance when no wrap is shorter (3-4-5 triangle)", () => {
    expect(torusDistance({ x: 0, y: 0 }, { x: 3, y: 4 }, 100, 100)).toBe(5);
  });

  it("returns 0 for the same point", () => {
    expect(torusDistance({ x: 10, y: 10 }, { x: 10, y: 10 }, 100, 100)).toBe(0);
  });

  it("uses the wrap-around path when it is shorter on the x axis", () => {
    expect(torusDistance({ x: 5, y: 50 }, { x: 95, y: 50 }, 100, 100)).toBe(10);
  });

  it("uses the wrap-around path on both axes", () => {
    expect(torusDistance({ x: 5, y: 5 }, { x: 95, y: 95 }, 100, 100)).toBeCloseTo(
      Math.sqrt(200),
      10,
    );
  });
});

describe("normalizeAngle", () => {
  it("leaves angles already within (-pi, pi] unchanged", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(Math.PI)).toBe(Math.PI);
    expect(normalizeAngle(-Math.PI)).toBe(-Math.PI);
  });

  it("wraps an angle just above pi", () => {
    expect(normalizeAngle(Math.PI + 1)).toBeCloseTo(1 - Math.PI, 10);
  });

  it("wraps an angle just below -pi", () => {
    expect(normalizeAngle(-Math.PI - 1)).toBeCloseTo(Math.PI - 1, 10);
  });

  it("wraps an angle that requires the loop to run (3*pi)", () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 10);
  });
});
```

- [ ] **Step 2: テストを実行して全てPASSすることを確認する**

Run: `bun run test -- geometry.test.ts`
Expected: 全ケースPASS(既存実装は変更していないため、失敗した場合は上記の期待値の計算ミスであり、実装のバグではないかをまず疑うこと)

- [ ] **Step 3: コミット**

```bash
git add src/lib/aco/geometry.test.ts
git commit -m "test: geometry.tsの特性テストを追加"
```

---

### Task 2: `collision.ts`のテスト

**Files:**
- Create: `src/lib/aco/collision.test.ts`

**Interfaces:**
- Consumes: `src/lib/aco/collision.ts`の`avoidCollisions(position, direction, otherAnts, currentAntId, worldWidth, worldHeight, params?): { direction: number; position: Position }`(既存・変更なし)
- Produces: `collision.test.ts`(独立)

- [ ] **Step 1: テストファイルを作成する**

```typescript
// src/lib/aco/collision.test.ts
import { describe, it, expect } from "vitest";
import { avoidCollisions } from "./collision";

describe("avoidCollisions", () => {
  it("returns the direction and position unchanged when there are no other ants", () => {
    const result = avoidCollisions({ x: 50, y: 50 }, 0, [], "a1", 100, 100);
    expect(result).toEqual({ direction: 0, position: { x: 50, y: 50 } });
  });

  it("excludes the current ant itself from collision checks", () => {
    const result = avoidCollisions(
      { x: 50, y: 50 },
      0,
      [{ id: "a1", position: { x: 52, y: 50 } }],
      "a1",
      100,
      100,
    );
    expect(result).toEqual({ direction: 0, position: { x: 50, y: 50 } });
  });

  it("ignores ants outside the avoidance radius", () => {
    const result = avoidCollisions(
      { x: 50, y: 50 },
      0,
      [{ id: "a2", position: { x: 70, y: 50 } }],
      "a1",
      100,
      100,
    );
    expect(result).toEqual({ direction: 0, position: { x: 50, y: 50 } });
  });

  it("steers away from a single nearby ant using the default params", () => {
    const result = avoidCollisions(
      { x: 50, y: 50 },
      0,
      [{ id: "a2", position: { x: 54, y: 50 } }],
      "a1",
      100,
      100,
    );
    expect(result.direction).toBeCloseTo(Math.PI / 2, 10);
    expect(result.position.x).toBeCloseTo(49.875, 10);
    expect(result.position.y).toBeCloseTo(50, 10);
  });

  it("respects custom avoidanceRadius and avoidanceStrength params", () => {
    const result = avoidCollisions(
      { x: 50, y: 50 },
      0,
      [{ id: "a2", position: { x: 54, y: 50 } }],
      "a1",
      100,
      100,
      { avoidanceRadius: 10, avoidanceStrength: 1 },
    );
    expect(result.direction).toBeCloseTo(Math.PI, 10);
    expect(result.position.x).toBeCloseTo(49.7, 10);
    expect(result.position.y).toBeCloseTo(50, 10);
  });

  it("accumulates avoidance force from multiple nearby ants and caps the strength at 1", () => {
    const result = avoidCollisions(
      { x: 50, y: 50 },
      0,
      [
        { id: "a2", position: { x: 54, y: 50 } },
        { id: "a3", position: { x: 50, y: 54 } },
      ],
      "a1",
      100,
      100,
    );
    expect(result.direction).toBeCloseTo((-3 * Math.PI) / 4, 10);
    expect(result.position.x).toBeCloseTo(49.75, 10);
    expect(result.position.y).toBeCloseTo(49.75, 10);
  });

  it("computes avoidance across the torus wrap boundary", () => {
    const result = avoidCollisions(
      { x: 2, y: 50 },
      0,
      [{ id: "a2", position: { x: 98, y: 50 } }],
      "a1",
      100,
      100,
    );
    expect(result.direction).toBeCloseTo(0, 10);
    expect(result.position.x).toBeCloseTo(2.125, 10);
    expect(result.position.y).toBeCloseTo(50, 10);
  });
});
```

- [ ] **Step 2: テストを実行して全てPASSすることを確認する**

Run: `bun run test -- collision.test.ts`
Expected: 全ケースPASS

- [ ] **Step 3: コミット**

```bash
git add src/lib/aco/collision.test.ts
git commit -m "test: collision.tsの特性テストを追加"
```

---

### Task 3: `pheromone.ts`のテスト

**Files:**
- Create: `src/lib/aco/pheromone.test.ts`

**Interfaces:**
- Consumes: `src/lib/aco/pheromone.ts`の`createPheromoneKey(position): string`、`depositPheromone(pheromones, position, type, amount): Map<string, Pheromone>`、`decayPheromones(pheromones, decayRate): Map<string, Pheromone>`、`getPheromoneStrength(pheromones, position, type): number`(既存・変更なし)
- Produces: `pheromone.test.ts`(独立)

- [ ] **Step 1: テストファイルを作成する**

```typescript
// src/lib/aco/pheromone.test.ts
import { describe, it, expect } from "vitest";
import { createPheromoneKey, depositPheromone, decayPheromones, getPheromoneStrength } from "./pheromone";
import type { Pheromone } from "./types";

describe("createPheromoneKey", () => {
  it("floors the position to a 10px grid cell", () => {
    expect(createPheromoneKey({ x: 23, y: 47 })).toBe("2,4");
  });

  it("handles the origin", () => {
    expect(createPheromoneKey({ x: 0, y: 0 })).toBe("0,0");
  });

  it("handles negative coordinates", () => {
    expect(createPheromoneKey({ x: -5, y: 15 })).toBe("-1,1");
  });
});

describe("depositPheromone", () => {
  it("creates a new pheromone snapped to the cell center when none exists", () => {
    const result = depositPheromone(new Map(), { x: 23, y: 47 }, "toFood", 5);
    expect(result.size).toBe(1);
    expect(result.get("2,4")).toEqual({
      position: { x: 25, y: 45 },
      intensity: 5,
      type: "toFood",
    });
  });

  it("accumulates intensity onto an existing pheromone", () => {
    const existing = new Map<string, Pheromone>([
      ["2,4", { position: { x: 25, y: 45 }, intensity: 90, type: "toFood" }],
    ]);
    const result = depositPheromone(existing, { x: 23, y: 47 }, "toFood", 5);
    expect(result.get("2,4")).toEqual({
      position: { x: 25, y: 45 },
      intensity: 95,
      type: "toFood",
    });
  });

  it("caps accumulated intensity at 100", () => {
    const existing = new Map<string, Pheromone>([
      ["2,4", { position: { x: 25, y: 45 }, intensity: 98, type: "toFood" }],
    ]);
    const result = depositPheromone(existing, { x: 23, y: 47 }, "toFood", 5);
    expect(result.get("2,4")?.intensity).toBe(100);
  });

  it("does not mutate the original map", () => {
    const original = new Map<string, Pheromone>();
    const result = depositPheromone(original, { x: 23, y: 47 }, "toFood", 5);
    expect(original.size).toBe(0);
    expect(result.size).toBe(1);
    expect(result).not.toBe(original);
  });

  it("keeps the existing pheromone's type when depositing a different type onto it (documented current behavior)", () => {
    // 既存挙動の確認: depositPheromoneは既存エントリの`type`を新しい引数で上書きしない。
    // 呼び出し側(ant-behavior.ts)は常に同じtypeで同じ位置に積むため実害はないが、
    // APIとしては直感に反するため、この仕様を明示的に固定しておく。
    const existing = new Map<string, Pheromone>([
      ["2,4", { position: { x: 25, y: 45 }, intensity: 10, type: "toFood" }],
    ]);
    const result = depositPheromone(existing, { x: 23, y: 47 }, "toNest", 5);
    expect(result.get("2,4")?.type).toBe("toFood");
  });
});

describe("decayPheromones", () => {
  it("reduces intensity and keeps the pheromone when above the threshold", () => {
    const map = new Map<string, Pheromone>([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" }],
    ]);
    const result = decayPheromones(map, 0.99);
    const decayed = result.get("1,1");
    expect(decayed).toBeDefined();
    expect(decayed!.intensity).toBeLessThan(50);
    expect(decayed!.intensity).toBeGreaterThan(0);
  });

  it("removes a pheromone whose intensity decays below the threshold", () => {
    const map = new Map<string, Pheromone>([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 0.05, type: "toFood" }],
    ]);
    const result = decayPheromones(map, 0.5);
    expect(result.has("1,1")).toBe(false);
  });

  it("does not mutate the original map", () => {
    const original = new Map<string, Pheromone>([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" }],
    ]);
    const result = decayPheromones(original, 0.99);
    expect(original.get("1,1")?.intensity).toBe(50);
    expect(result).not.toBe(original);
  });

  it("decays multiple pheromones independently", () => {
    const map = new Map<string, Pheromone>([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" }],
      ["2,2", { position: { x: 25, y: 25 }, intensity: 80, type: "toNest" }],
    ]);
    const result = decayPheromones(map, 0.95);
    expect(result.get("1,1")!.intensity).toBeLessThan(50);
    expect(result.get("2,2")!.intensity).toBeLessThan(80);
  });

  it("evaporates less with a higher decayRate (weaker evaporation)", () => {
    const map = new Map<string, Pheromone>([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" }],
    ]);
    const strong = decayPheromones(map, 0.9).get("1,1")!.intensity;
    const weak = decayPheromones(map, 0.999).get("1,1")!.intensity;
    expect(weak).toBeGreaterThan(strong);
  });
});

describe("getPheromoneStrength", () => {
  it("returns 0 for an empty map", () => {
    expect(getPheromoneStrength(new Map(), { x: 0, y: 0 }, "toFood")).toBe(0);
  });

  it("computes strength from a single matching pheromone within range", () => {
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 10, y: 0 }, intensity: 60, type: "toFood" }],
    ]);
    expect(getPheromoneStrength(map, { x: 0, y: 0 }, "toFood")).toBeCloseTo(60 / 11, 10);
  });

  it("excludes pheromones at or beyond the 30-unit detection radius", () => {
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 30, y: 0 }, intensity: 60, type: "toFood" }],
    ]);
    expect(getPheromoneStrength(map, { x: 0, y: 0 }, "toFood")).toBe(0);
  });

  it("excludes pheromones of a different type", () => {
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 10, y: 0 }, intensity: 60, type: "toNest" }],
    ]);
    expect(getPheromoneStrength(map, { x: 0, y: 0 }, "toFood")).toBe(0);
  });

  it("sums strength across multiple matching pheromones", () => {
    const map = new Map<string, Pheromone>([
      ["a", { position: { x: 0, y: 0 }, intensity: 20, type: "toFood" }],
      ["b", { position: { x: 10, y: 0 }, intensity: 60, type: "toFood" }],
    ]);
    expect(getPheromoneStrength(map, { x: 0, y: 0 }, "toFood")).toBeCloseTo(20 + 60 / 11, 10);
  });
});
```

- [ ] **Step 2: テストを実行して全てPASSすることを確認する**

Run: `bun run test -- pheromone.test.ts`
Expected: 全ケースPASS。もし「既存挙動の確認」ケース(type上書きなし)が意図と違うと感じたら、実装を直すかどうかをこの時点でユーザーに確認すること(Phase 0の目的である「既存挙動の疑問点の洗い出し」に該当)

- [ ] **Step 3: コミット**

```bash
git add src/lib/aco/pheromone.test.ts
git commit -m "test: pheromone.tsの特性テストを追加"
```

---

### Task 4: `movement.ts`のテスト

**Files:**
- Create: `src/lib/aco/movement.test.ts`

**Interfaces:**
- Consumes: `src/lib/aco/movement.ts`の`moveAnt(position, direction, worldWidth, worldHeight, params?): MovementResult`、`moveTowardsTarget(position, target, worldWidth, worldHeight, speed?): Position`、`moveWithBias(position, direction, target, worldWidth, worldHeight, params?): MovementResult`(既存・変更なし)
- Produces: `movement.test.ts`(独立)

- [ ] **Step 1: テストファイルを作成する**

```typescript
// src/lib/aco/movement.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { moveAnt, moveTowardsTarget, moveWithBias } from "./movement";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("moveTowardsTarget", () => {
  it("returns the target directly once within speed distance", () => {
    const target = { x: 1, y: 0 };
    expect(moveTowardsTarget({ x: 0, y: 0 }, target, 100, 100, 2)).toEqual(target);
  });

  it("moves toward a distant target by exactly `speed` units", () => {
    expect(moveTowardsTarget({ x: 0, y: 0 }, { x: 10, y: 0 }, 100, 100, 2)).toEqual({
      x: 2,
      y: 0,
    });
  });

  it("lands exactly on the target when distance equals speed", () => {
    expect(moveTowardsTarget({ x: 0, y: 0 }, { x: 3, y: 4 }, 100, 100, 5)).toEqual({
      x: 3,
      y: 4,
    });
  });

  it("takes the shorter path across the torus wrap boundary", () => {
    expect(moveTowardsTarget({ x: 5, y: 50 }, { x: 95, y: 50 }, 100, 100, 2)).toEqual({
      x: 3,
      y: 50,
    });
  });
});

describe("moveAnt", () => {
  it("moves in a straight line when randomTurnRange is 0", () => {
    const result = moveAnt({ x: 0, y: 0 }, 0, 100, 100, { speed: 2, randomTurnRange: 0 });
    expect(result.direction).toBe(0);
    expect(result.position.x).toBeCloseTo(2, 10);
    expect(result.position.y).toBeCloseTo(0, 10);
  });

  it("uses the default speed and randomTurnRange when params are omitted", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // (0.5 - 0.5) * range = 0, no turn
    const result = moveAnt({ x: 10, y: 10 }, Math.PI / 2, 100, 100);
    expect(result.direction).toBeCloseTo(Math.PI / 2, 10);
    expect(result.position.x).toBeCloseTo(10, 5);
    expect(result.position.y).toBeCloseTo(12, 10);
  });

  it("applies a random turn proportional to randomTurnRange", () => {
    vi.spyOn(Math, "random").mockReturnValue(1); // (1 - 0.5) * 0.5 = 0.25 turn
    const result = moveAnt({ x: 0, y: 0 }, 0, 100, 100, { speed: 2, randomTurnRange: 0.5 });
    expect(result.direction).toBeCloseTo(0.25, 10);
    expect(result.position.x).toBeCloseTo(Math.cos(0.25) * 2, 10);
    expect(result.position.y).toBeCloseTo(Math.sin(0.25) * 2, 10);
  });
});

describe("moveWithBias", () => {
  it("keeps direction unchanged when already aligned with the target and no randomness", () => {
    const result = moveWithBias({ x: 0, y: 0 }, 0, { x: 10, y: 0 }, 100, 100, {
      speed: 2,
      randomTurnRange: 0,
      biasStrength: 0.3,
    });
    expect(result.direction).toBe(0);
    expect(result.position.x).toBeCloseTo(2, 10);
    expect(result.position.y).toBeCloseTo(0, 10);
  });

  it("blends toward the target direction proportional to biasStrength", () => {
    const result = moveWithBias({ x: 0, y: 0 }, 0, { x: 0, y: 10 }, 100, 100, {
      speed: 2,
      randomTurnRange: 0,
      biasStrength: 0.5,
    });
    expect(result.direction).toBeCloseTo(Math.PI / 4, 10);
    expect(result.position.x).toBeCloseTo(Math.cos(Math.PI / 4) * 2, 10);
    expect(result.position.y).toBeCloseTo(Math.sin(Math.PI / 4) * 2, 10);
  });

  it("applies the random turn scaled by (1 - biasStrength) when biasStrength is 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(1); // (1 - 0.5) * 0.4 = 0.2 turn
    const result = moveWithBias({ x: 0, y: 0 }, 0, { x: 10, y: 0 }, 100, 100, {
      speed: 2,
      randomTurnRange: 0.4,
      biasStrength: 0,
    });
    expect(result.direction).toBeCloseTo(0.2, 10);
    expect(result.position.x).toBeCloseTo(Math.cos(0.2) * 2, 10);
    expect(result.position.y).toBeCloseTo(Math.sin(0.2) * 2, 10);
  });
});
```

- [ ] **Step 2: テストを実行して全てPASSすることを確認する**

Run: `bun run test -- movement.test.ts`
Expected: 全ケースPASS

- [ ] **Step 3: コミット**

```bash
git add src/lib/aco/movement.test.ts
git commit -m "test: movement.tsの特性テストを追加"
```

---

### Task 5: `pathfinding.ts`のテスト

**Files:**
- Create: `src/lib/aco/pathfinding.test.ts`

**Interfaces:**
- Consumes: `src/lib/aco/pathfinding.ts`の`followPheromone(position, pheromones, targetType, direction, worldWidth, worldHeight, params?): number`、`findNearestTarget(position, targets, worldWidth, worldHeight, maxDistance?): T | null`、`getTargetsInRadius(position, targets, radius, worldWidth, worldHeight): T[]`(既存・変更なし)
- Produces: `pathfinding.test.ts`(独立)

- [ ] **Step 1: テストファイルを作成する**

```typescript
// src/lib/aco/pathfinding.test.ts
import { describe, it, expect } from "vitest";
import { followPheromone, findNearestTarget, getTargetsInRadius } from "./pathfinding";
import type { Pheromone } from "./types";

describe("followPheromone", () => {
  it("keeps the direction unchanged when no pheromone of the target type exists", () => {
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 20, y: 0 }, intensity: 100, type: "toNest" }],
    ]);
    expect(followPheromone({ x: 0, y: 0 }, map, "toFood", 0.5, 100, 100)).toBe(0.5);
  });

  it("keeps the direction unchanged when all sensors are out of detection range", () => {
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 1000, y: 1000 }, intensity: 100, type: "toFood" }],
    ]);
    expect(followPheromone({ x: 0, y: 0 }, map, "toFood", 1.23, 100, 100)).toBe(1.23);
  });

  it("keeps direction unchanged when the strongest signal is at the center sensor", () => {
    // Center sensor position for direction=0 is exactly (20, 0) — place the pheromone there.
    const map = new Map<string, Pheromone>([
      ["k", { position: { x: 20, y: 0 }, intensity: 100, type: "toFood" }],
    ]);
    expect(followPheromone({ x: 0, y: 0 }, map, "toFood", 0, 100, 100)).toBe(0);
  });

  it("steers toward the left sensor when the strongest signal is there", () => {
    // Left sensor position for direction=0 is (20*cos(-pi/4), 20*sin(-pi/4)).
    const leftSensorPos = { x: 20 * Math.cos(-Math.PI / 4), y: 20 * Math.sin(-Math.PI / 4) };
    const map = new Map<string, Pheromone>([
      ["k", { position: leftSensorPos, intensity: 100, type: "toFood" }],
    ]);
    expect(followPheromone({ x: 0, y: 0 }, map, "toFood", 0, 100, 100)).toBe(-Math.PI / 4);
  });
});

describe("findNearestTarget", () => {
  it("returns the closest target among several", () => {
    const targets = [
      { position: { x: 10, y: 0 } },
      { position: { x: 5, y: 0 } },
      { position: { x: 20, y: 0 } },
    ];
    expect(findNearestTarget({ x: 0, y: 0 }, targets, 100, 100)).toBe(targets[1]);
  });

  it("returns null when there are no targets", () => {
    expect(findNearestTarget({ x: 0, y: 0 }, [], 100, 100)).toBeNull();
  });

  it("returns null when the nearest target is beyond maxDistance", () => {
    const targets = [{ position: { x: 50, y: 0 } }];
    expect(findNearestTarget({ x: 0, y: 0 }, targets, 100, 100, 10)).toBeNull();
  });

  it("returns the target when it is within maxDistance", () => {
    const targets = [{ position: { x: 5, y: 0 } }];
    expect(findNearestTarget({ x: 0, y: 0 }, targets, 100, 100, 10)).toBe(targets[0]);
  });

  it("uses torus-aware distance to find a target across the wrap boundary", () => {
    const targets = [{ position: { x: 98, y: 0 } }];
    expect(findNearestTarget({ x: 2, y: 0 }, targets, 100, 100, 10)).toBe(targets[0]);
  });
});

describe("getTargetsInRadius", () => {
  it("includes targets within the radius and excludes those beyond it (radius is inclusive)", () => {
    const near = { position: { x: 5, y: 0 }, label: "near" };
    const atRadius = { position: { x: 10, y: 0 }, label: "atRadius" };
    const beyond = { position: { x: 15, y: 0 }, label: "beyond" };
    const result = getTargetsInRadius({ x: 0, y: 0 }, [near, atRadius, beyond], 10, 1000, 1000);
    expect(result).toEqual([near, atRadius]);
  });

  it("returns an empty array when nothing is within radius", () => {
    const targets = [{ position: { x: 500, y: 0 } }];
    expect(getTargetsInRadius({ x: 0, y: 0 }, targets, 10, 1000, 1000)).toEqual([]);
  });

  it("uses torus-aware distance across the wrap boundary", () => {
    const targets = [{ position: { x: 98, y: 0 } }];
    expect(getTargetsInRadius({ x: 2, y: 0 }, targets, 10, 100, 100)).toEqual(targets);
  });
});
```

- [ ] **Step 2: テストを実行して全てPASSすることを確認する**

Run: `bun run test -- pathfinding.test.ts`
Expected: 全ケースPASS

- [ ] **Step 3: コミット**

```bash
git add src/lib/aco/pathfinding.test.ts
git commit -m "test: pathfinding.tsの特性テストを追加"
```

---

### Task 6: `simulation-engine.ts`のテスト

**Files:**
- Create: `src/lib/aco/simulation-engine.test.ts`

**Interfaces:**
- Consumes: `src/lib/aco/simulation-engine.ts`の`executeSimulationStep(config: SimulationConfig, state: SimulationState): SimulationUpdate`、`executePheromoneDacay(pheromones, decayRate): Map<string, Pheromone>`(既存・変更なし)
- Produces: `simulation-engine.test.ts`。Task 7で`useSimulation.ts`をこのテストで確認済みの`executeSimulationStep`/`executePheromoneDacay`に配線するため、Task 7より先に完了させておく

- [ ] **Step 1: テストファイルを作成する**

```typescript
// src/lib/aco/simulation-engine.test.ts
import { describe, it, expect } from "vitest";
import { executeSimulationStep, executePheromoneDacay } from "./simulation-engine";
import type { SimulationConfig } from "./types";
import type { SimulationState } from "./simulation-engine";

const baseConfig: SimulationConfig = {
  worldWidth: 800,
  worldHeight: 600,
  antCount: 1,
  pheromoneDecayRate: 0.99,
  pheromoneDepositAmount: 2,
  pheromoneTrackingStrength: 0.7,
  speed: 1,
};

describe("executeSimulationStep", () => {
  it("moves a single foraging ant with no food nearby and does not touch foods/pheromones", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 100, y: 100 },
          hasFood: false,
          targetFood: null,
          direction: 0,
          foodAmount: null,
        },
      ],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep(baseConfig, state);

    expect(update.ants).toBeDefined();
    expect(update.ants).toHaveLength(1);
    expect(update.foods).toBeUndefined();
    expect(update.pheromones).toBeUndefined();
  });

  it("drops food and does not deposit pheromone when a returning ant reaches the nest", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 395, y: 295 }, // within NEST_ARRIVAL_RANGE (10) of {400,300}
          hasFood: true,
          targetFood: "food-1",
          direction: 0,
          foodAmount: 10,
        },
      ],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep(baseConfig, state);

    expect(update.ants?.[0]).toMatchObject({
      hasFood: false,
      targetFood: null,
      foodAmount: null,
    });
    expect(update.pheromones).toBeUndefined();
  });

  it("deposits a toFood pheromone when a returning ant is away from the nest", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 100, y: 100 },
          hasFood: true,
          targetFood: "food-1",
          direction: 0,
          foodAmount: 10,
        },
      ],
      foods: [],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep(baseConfig, state);

    expect(update.pheromones).toBeDefined();
    expect(update.pheromones!.size).toBe(1);
    expect(Array.from(update.pheromones!.values())[0].type).toBe("toFood");
  });

  it("reduces food amount when a foraging ant collects it, and updates that ant's state", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 100, y: 100 },
          hasFood: false,
          targetFood: null,
          direction: 0,
          foodAmount: null,
        },
      ],
      foods: [{ id: "food-1", position: { x: 105, y: 105 }, amount: 10 }],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep(baseConfig, state);

    expect(update.foods).toEqual([{ id: "food-1", position: { x: 105, y: 105 }, amount: 9 }]);
    expect(update.ants?.[0]).toMatchObject({ hasFood: true, targetFood: "food-1", foodAmount: 10 });
  });

  it("removes food that reaches zero amount and merges per-ant results across multiple ants", () => {
    const state: SimulationState = {
      ants: [
        {
          id: "ant-1",
          position: { x: 100, y: 100 },
          hasFood: false,
          targetFood: null,
          direction: 0,
          foodAmount: null,
        },
        {
          id: "ant-2",
          position: { x: 300, y: 300 },
          hasFood: false,
          targetFood: null,
          direction: 1,
          foodAmount: null,
        },
      ],
      foods: [{ id: "food-1", position: { x: 105, y: 105 }, amount: 1 }],
      pheromones: new Map(),
      nest: { x: 400, y: 300 },
    };

    const update = executeSimulationStep({ ...baseConfig, antCount: 2 }, state);

    expect(update.foods).toEqual([]);
    expect(update.ants).toHaveLength(2);
    const updatedIds = update.ants!.map((a) => a.id);
    expect(updatedIds).toEqual(["ant-1", "ant-2"]);
  });
});

describe("executePheromoneDacay", () => {
  it("decays pheromone intensity", () => {
    const pheromones = new Map([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" as const }],
    ]);

    const result = executePheromoneDacay(pheromones, 0.99);

    expect(result.get("1,1")!.intensity).toBeLessThan(50);
  });

  it("does not mutate the original map", () => {
    const pheromones = new Map([
      ["1,1", { position: { x: 15, y: 15 }, intensity: 50, type: "toFood" as const }],
    ]);

    const result = executePheromoneDacay(pheromones, 0.99);

    expect(pheromones.get("1,1")!.intensity).toBe(50);
    expect(result).not.toBe(pheromones);
  });
});
```

- [ ] **Step 2: テストを実行して全てPASSすることを確認する**

Run: `bun run test -- simulation-engine.test.ts`
Expected: 全ケースPASS

- [ ] **Step 3: コミット**

```bash
git add src/lib/aco/simulation-engine.test.ts
git commit -m "test: simulation-engine.tsの特性テストを追加"
```

---

### Task 7: `useSimulation.ts`を`simulation-engine.ts`に一本化する

**Files:**
- Modify: `src/hooks/useSimulation.ts`(全体書き換え)
- Modify: `src/hooks/useSimulation.test.ts`(全体書き換え)

**Interfaces:**
- Consumes: Task 6でテスト済みの`executeSimulationStep(config, state)`/`executePheromoneDacay(pheromones, decayRate)`(`src/lib/aco/simulation-engine.ts`)
- Produces: `useSimulation(): void`(公開シグネチャは変更なし。`src/components/ACOSimulation/index.tsx`の`useSimulation()`呼び出しはそのまま動作する)

このタスクでは`useSimulation.ts`が独自に持っていた`processAnts`/`applyUpdates`(`simulation-engine.ts`の`processAllAnts`/`applyBehaviorResults`と同じ役割の重複コード)を削除し、`executeSimulationStep`/`executePheromoneDacay`を呼ぶだけに置き換える。副次効果として、既存のlintエラー(`pheromoneDecayRate`が未使用)と、`useSimulation.test.ts`の`bun:test` importによるビルド/vitestの失敗が解消される。

- [ ] **Step 1: `useSimulation.ts`を書き換える**

```typescript
// src/hooks/useSimulation.ts
import { useEffect, useRef } from "react";
import { useSimulationStore } from "../stores/simulation.store";
import { executeSimulationStep, executePheromoneDacay } from "../lib/aco/simulation-engine";
import type { SimulationUpdate } from "../lib/aco/simulation-engine";

const FRAME_DELAY_MS = 50;
const PHEROMONE_DECAY_INTERVAL_MS = 500;

export const useSimulation = () => {
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastDecayTimeRef = useRef<number>(0);

  const simulationState = useSimulationStore();

  const animate = (currentTime: number) => {
    if (!simulationState.isRunning) {
      lastTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const deltaTime = currentTime - lastTimeRef.current;

    if (deltaTime > FRAME_DELAY_MS / simulationState.speed) {
      performSimulationStep(currentTime);
      lastTimeRef.current = currentTime;
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const performSimulationStep = (currentTime: number) => {
    const {
      ants,
      foods,
      pheromones,
      nest,
      worldWidth,
      worldHeight,
      antCount,
      pheromoneDecayRate,
      pheromoneDepositAmount,
      pheromoneTrackingStrength,
      speed,
    } = simulationState;

    const update = executeSimulationStep(
      {
        worldWidth,
        worldHeight,
        antCount,
        pheromoneDecayRate,
        pheromoneDepositAmount,
        pheromoneTrackingStrength,
        speed,
      },
      { ants, foods, pheromones, nest },
    );

    applyUpdate(update, currentTime);
  };

  const applyUpdate = (update: SimulationUpdate, currentTime: number) => {
    useSimulationStore.setState((state) => {
      const next: Partial<typeof state> = {};

      if (update.ants) next.ants = update.ants;
      if (update.foods) next.foods = update.foods;

      let pheromones = update.pheromones ?? state.pheromones;
      if (currentTime - lastDecayTimeRef.current > PHEROMONE_DECAY_INTERVAL_MS) {
        pheromones = executePheromoneDacay(pheromones, state.pheromoneDecayRate);
        lastDecayTimeRef.current = currentTime;
      }
      if (pheromones !== state.pheromones) next.pheromones = pheromones;

      return next;
    });
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    simulationState.isRunning,
    simulationState.speed,
    simulationState.ants,
    simulationState.foods,
    simulationState.pheromones,
  ]);
};
```

- [ ] **Step 2: `useSimulation.test.ts`を`vitest`記法に修正し、スモークテストを1件追加する**

```typescript
// src/hooks/useSimulation.test.ts
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSimulation } from "./useSimulation";

describe("useSimulation", () => {
  it("should export useSimulation function", () => {
    expect(typeof useSimulation).toBe("function");
  });

  it("should not throw when rendered", () => {
    expect(() => renderHook(() => useSimulation())).not.toThrow();
  });
});
```

- [ ] **Step 3: テストとビルドを実行して確認する**

Run: `bun run test -- useSimulation.test.ts`
Expected: 2ケースともPASS

Run: `bun run build`
Expected: `pheromoneDecayRate`未使用エラーと`bun:test`型解決エラーが両方とも解消され、ビルドが成功する

- [ ] **Step 4: コミット**

```bash
git add src/hooks/useSimulation.ts src/hooks/useSimulation.test.ts
git commit -m "refactor: useSimulation.tsをsimulation-engine.tsに一本化"
```

---

### Task 8: 最終確認

**Files:** なし(検証のみ)

**Interfaces:** なし

- [ ] **Step 1: 全テストを実行する**

Run: `bun run test`
Expected: 全テストファイルPASS(Task 1〜7で追加・修正したファイルを含む)

- [ ] **Step 2: bunネイティブテストランナーでも実行する**

Run: `bun run test:bun`
Expected: PASS(既存の`*.test.ts`のうち`bun:test`を使うものは無くなっているはずなので、実質vitestと同じファイル群がbunのテストランナーでも動作することを確認する)

- [ ] **Step 3: lintを実行する**

Run: `bun run lint`
Expected: `useSimulation.ts`の`pheromoneDecayRate`未使用エラーが解消されていることを確認する。`react-hooks/exhaustive-deps`の既存警告(`animate`の依存漏れ)は本Phaseのスコープ外のため残っていてよい

- [ ] **Step 4: ビルドを実行する**

Run: `bun run build`
Expected: 成功する(このPhase開始時点で残っていた2件のビルドエラーが両方解消されていることを確認する)

- [ ] **Step 5: 設計ドキュメントのステータスを更新してコミット**

`docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md`の冒頭にPhase 0完了の注記を追記する:

```markdown
- ステータス: 承認済み(実装計画へ移行)
- Phase 0(既存TS実装のテスト強化): 完了 — `docs/superpowers/plans/2026-08-12-aco-core-phase0-test-hardening.md`
```

```bash
git add docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md
git commit -m "docs: Phase 0(テスト強化)完了をspecに反映"
```
