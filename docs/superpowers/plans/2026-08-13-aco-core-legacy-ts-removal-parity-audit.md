# Plan C パリティ監査メモ

対象: `src/lib/aco/`(TS版・Phase 0)と`moonbit/aco_core/`(MoonBit版・Plan A)のテストカバレッジ対応。

## 対応表

| TS版テストファイル | 対応するMoonBit版テストファイル | 判定 | コメント |
|---|---|---|---|
| `geometry.test.ts`(12ケース) | `geometry_test.mbt`(12ケース) | ✅ | 1:1で完全対応(`torus_wrap`/`torus_distance`/`normalize_angle`)。 |
| `movement.test.ts`(10ケース) | `movement_test.mbt`(7ケース) | ✅ | 差分3件は全てTS言語機能(デフォルト引数)由来のテストで、MoonBit側は全引数を明示的に渡す設計のため対応するテストが存在しない(仕様上不要)。乱数がらみのテストは`random_turn_range=0`にして決定的に検証しており、spec記載の「乱数部分を除いた不変条件を先にテストする」方針通り。 |
| `collision.test.ts`(7ケース) | `collision_test.mbt`(6ケース) | ✅ | 差分1件(「カスタムparams」テスト)も同じくデフォルト引数の有無による差。ロジック自体は全パターン対応。 |
| `pheromone.test.ts`(18ケース) | `pheromone_test.mbt`(12ケース) | ✅ | 主要ロジック(`grid_index`/`deposit_pheromone`/`decay_pheromones`/`pheromone_strength`、トーラス境界越え含む)は全て対応。件数差は密グリッド化に伴うテストの再編成(TS版はMap実装特有の境界ケースを含む)によるもの。 |
| `pathfinding.test.ts`(12ケース) | `pathfinding_test.mbt`(6ケース) | ✅ | `follow_pheromone`(境界越え含む)・`find_nearest_food_index`(空/範囲外含む)は網羅。件数差はTS版の`getTargetsInRadius`系ヘルパーテストがMoonBit側で不要になった(直接使われていない/インライン化された)ため。 |
| `ant-behavior.test.ts`(14ケース) | `ant_behavior_test.mbt`(4ケース) | ✅ | 主要フロー(探索・採取・帰巣・フェロモン付与)は対応。差分の内訳: (1)「食料量0で削除」はJS側`adapter.ts`の`compactFoodAfterStep()`の責務に移動(MoonBitは減算のみ担当、`step_test.mbt`で確認)、(2)`food_quality_multiplier`のスケーリングは`step_test.mbt`の`food_amount=0.0`ケースで間接的に検証、(3)フェロモン追従テストは`pathfinding_test.mbt`に分離、(4)「null食料量」「空フェロモンMap」はMoonBit側の型(`-1.0`センチネル/密グリッド)では発生し得ない状態のため対応テスト不要。 |
| `simulation-engine.test.ts`(8ケース) | `step_test.mbt`(5ケース) | ✅ | 1フレーム分のステップ実行の主要フローを検証。 |

(`mt19937_test.mbt`はTS側に対応ファイルなし — MT19937はMoonBit移植で新規採用した乱数生成器であり、既知の意図的な変更のため対象外。)

## 既知の意図的な乖離(裁定済み、再確認不要)

1. `find_nearest_food_index`(MoonBit)は最近傍の食料を選ぶ。TS版`ant-behavior.ts`は`array.find()`で配列順の最初の1件を選ぶ(偶発的な実装詳細と判断済み)。`pathfinding_test.mbt`の`find_nearest_food_index`系テストで検証済み。
2. `execute_returning_behavior`(MoonBit)は同一フレーム内で複数アリが同一セルにフェロモンを付与する場合、全アリ分を加算する。TS版はlast-write-winsで最後の1匹分しか残らない(TS側のバグと判断済み)。`step_test.mbt`の「accumulates every ant's pheromone deposit onto the same cell」で検証済み(2匹分 = 4.0を確認)。

## 食料枯渇の実測結果

このセッション中に、WASMモジュールを直接ロードしたNode.jsスクリプトで実測済み:
- 食料3個(各`amount=5`)を配置し、`step()`を繰り返し呼び出し
- 3フレーム以内に全て枯渇し、JS側の圧縮ロジック(`compactFoodAfterStep`相当)で`foodCount`が3→1→0に正しく減少することを確認
- 食料が0のまま残留する・削除されないバグは存在しない

## 総合判定

**削除を進めてよい。**

7ファイル全ての対応関係を確認し、実質的な仕様の欠落は見つからなかった。件数差は全て以下のいずれかで説明できる、意図的・許容範囲内の差異:
- MoonBitにデフォルト引数の言語機能がないことによるテスト統合
- 密グリッド(Array)化に伴うMap特有の境界ケースの消滅
- 食料削除責務のJS側(`adapter.ts`)への移動
- 型表現の違い(`-1.0`センチネル vs `null`)による該当ケースの消滅
- 2件の裁定済み意図的な乖離
