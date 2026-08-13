# ACOシミュレーションコアのMoonBit/WASM移行 設計

- 作成日: 2026-08-12
- ステータス: 承認済み(実装計画へ移行)
- Phase 0(既存TS実装のテスト強化): 完了 — `docs/superpowers/plans/2026-08-12-aco-core-phase0-test-hardening.md`
- Phase 1 最小スパイク(wasm/wasm-gcターゲット検証): 完了 — `wasm`(非GC)採用確定(`moonbit-spike`/`moonbit-spike-2`ブランチ、`moonbit/aco_core/`)。zero-copyメモリアクセスの追加検証によりwasm-gcから変更
- Plan A(MoonBitコアロジック移植): 完了 — `docs/superpowers/plans/2026-08-12-aco-core-moonbit-port.md`
- Plan B(JS側統合): 完了 — `docs/superpowers/plans/2026-08-13-aco-core-js-integration.md`。シミュレーションが実際にWASM経由でブラウザ上で動作する状態

## 背景・動機

現状(アリ50匹・800×600ワールド)では体感的な性能問題は顕在化していないが、以下を見据えてホットパスをWASM化する:

- アリ数の大幅な増加
- 空間分割・経路探索などより重い処理の追加
- JSシングルスレッド性能の将来的な限界への備え

WASMターゲットとして **MoonBit** を採用する(Rustではなく)。

## スコープ

### 対象(毎フレーム実行されるホットパス)

- `ant-behavior`(アリの行動決定)
- `movement`(移動計算)
- `collision`(衝突回避)
- `pheromone`(フェロモンの放出・減衰・強度計算)
- `pathfinding`(フェロモン追跡・最近傍探索)

### 対象外

- React/Zustandの状態管理(状態はTS/Zustand側が保持し続ける)
- Canvas描画(`SimulationCanvas.tsx`)
- UI操作・コントロール
- ant/foodのID発行・追加削除ロジック(低頻度操作はJS側に残す)

## アーキテクチャ:フレーム単位バッチ呼び出し + SoA

### 検討した3案

| 案 | 内容 | 判定 |
|---|---|---|
| **A. フレーム単位バッチ呼び出し(SoA)** | 毎フレーム1回だけWASM境界を越え、Ant/Food/Pheromoneをtyped arrayで丸ごと渡す | 採用 |
| B. アリ単位でWASM呼び出し | `executeAntBehavior`を1:1でWASM関数に置き換え | 不採用: 毎フレーム50回以上の呼び出し+オブジェクトmarshalingが発生し、境界越えオーバーヘッドが計算量を上回りかねない |
| C. 状態も含めエンジン全体をWASMが所有 | Zustandは参照のみ保持 | 不採用: 「状態はTS/Zustand側」というスコープを超え、devtools可視性やテスト構成への影響が大きい |

### 採用理由

WASM境界越えのコストは呼び出し回数に比例して効く。案Aなら毎フレーム1回の境界越えで済み、フェロモンをMapから密なグリッド配列に変えることで`getPheromoneStrength`の全件走査(O(アリ数×フェロモン数))も局所参照に改善できる副次効果もある。

## データレイアウト

- **Ants**: `Float64Array`(x, y, direction)+ `Uint8Array`(hasFood)+ `Int32Array`(targetFoodIndex、-1でnull)+ `Float64Array`(foodAmount、-1.0でnull)
- **Foods**: `Float64Array`(x, y, amount)。追加削除は低頻度操作なのでその都度リサイズ
- **Pheromones**: 現行の`createPheromoneKey`が10px格子キーであることを利用し、`(worldWidth/10) × (worldHeight/10)`の密な`Float64Array`をtoFood/toNest用に2枚。world サイズ変更時のみリサイズ(実装は`FixedArray[Double]`→JS側`Float64Array`。設計時点では`Float32Array`を想定していたが、Plan Aの実装に合わせて修正)
- **ID**: アリ・食料ともに文字列IDは持たない。個体を外部から参照するコードが存在しないため、全てindexベースで扱う(Plan B実装時にgrepで確認し、より単純な設計へ変更)

### 乱数

`Math.random()`をWASM側から都度呼ぶと境界越えが増えるため、MoonBit内に自前PRNGを実装し完結させる。アルゴリズムは**メルセンヌ・ツイスタ(MT19937)**を採用する。シードはJS側から初期化時に一度だけ渡す。

- `geometry.mbt`と同様、`mt19937.mbt`として独立モジュール化し、`*_test.mbt`で既知のシード値に対する出力列の妥当性(標準的なテストベクタ、または最低限「同一シード→同一系列の再現性」)を先にテストする(Phase 1以降のTDD方針に準拠)

## モジュール構成・ビルド

- 新規ディレクトリ `moonbit/aco_core/`(MoonBitのプロジェクト名にハイフンは使えないためアンダースコア。`moon.mod.json` + `geometry.mbt` / `mt19937.mbt` / `movement.mbt` / `collision.mbt` / `pheromone.mbt` / `pathfinding.mbt` / `step.mbt`)
- `step.mbt` が唯一のエクスポート関数`step(...)`としてホットパス全体をまとめて実行
- ビルド成果物は `src/wasm/aco_core.wasm` に配置。Vite側は追加ライブラリを増やさず、`fetch` + `WebAssembly.instantiateStreaming`の薄い自前ローダーで読み込む
- パッケージ設定は `moon.pkg`(MoonBit独自DSL)を使用し、先頭で `pkgtype(kind: "foreign_library")` を宣言する。エクスポートする各public関数には `#export_name("...")` アトリビュートを付与する(関数名の近くに書けて可読性が高く、公式ドキュメントも新方式として推奨している)。メモリエクスポートは `options("link": {"wasm": {"export-memory-name": "memory"}})` で設定する

### 要検証事項 → スパイクで解消(2026-08-12、2回の追加検証を経て確定)

最初のスパイク(`moonbit-spike`ブランチ)では`wasm-gc`採用と結論したが、SoA/zero-copy設計の核心である「JS側からWASMの線形メモリをtyped arrayとして直接読み書きできるか」を追加検証した結果、**結論を`wasm`(非GC)ターゲットに変更する。**

**検証内容と結論:**

- **`wasm-gc`では、`FixedArray[Double]`等の戻り値がJSから見て不透明な参照(`[Object: null prototype] {}`)になり、線形メモリ経由でtyped arrayとして直接読めないことを実機で確認した。** MoonBitのFFIドキュメントにも「`FixedArray[Byte]/Bytes`はWasm/Wasm-GCどちらでも`externref`にマップされる」と明記されており、これはwasm-gc(WasmGC提案)の仕様上の制約(GC管理オブジェクトはホストに対して不透明)によるもので、ツールチェインのバージョンに依らない
- **`wasm`(非GC)ターゲットでは、`FixedArray[Double]`を返す関数の戻り値が生のi32ポインタ(線形メモリオフセット)になり、`new Float64Array(memory.buffer, ptr, length)`でゼロコピーに読めることを実機で確認した。** 同様に、`FixedArray[Double]`を引数に取る関数にJS側から取得したポインタをそのまま渡すことも確認済み(往復動作を確認)
- ポインタの生存期間: 参照カウント方式のGCのため、値を読み終えるまでの短い区間(同一フレーム内での読み取り)では有効性を確認したが、フレームをまたいで古いポインタを保持し続ける使い方は避ける設計とする(毎フレーム新しく`step()`を呼び、その場で結果を読み切る現設計と整合)
- **ビルド設定の重要な訂正**: 当初想定していた `moon.pkg.json`(JSON形式)の `link.wasm-gc.exports` + `export-memory-name` の組み合わせは、検証したツールチェインバージョン(`moon 0.1.20260522`)で関数エクスポートが消えるバグがあった。`moon upgrade`で最新版(`moon 0.1.20260807`)に更新し、`moon.pkg`(DSL形式)+ `pkgtype(kind: "foreign_library")` + `#export_name(...)` アトリビュート方式に切り替えたところ、関数・メモリの同時エクスポートが正しく動作した
- Viteは追加プラグイン無しで動作する: `new URL("./x.wasm", import.meta.url)` パターンで静的アセットとして扱われ、小さいファイルはdata URLにインライン化、大きいファイルはハッシュ付きアセットとして出力される。どちらの経路でも配信時のMIMEタイプは自動的に `application/wasm` になり、`WebAssembly.instantiateStreaming` がそのまま使える(この結論は1回目のスパイクのまま変更なし)
- **未検証**: 実ブラウザでの`WebAssembly.instantiateStreaming`実行(本セッションではブラウザ拡張が利用不可だったため)。Phase 1本実装の早い段階で一度ブラウザ実地確認を行うこと

## JS側アダプタ層

- 新規 `src/lib/aco-wasm/adapter.ts`: Zustandの`ants[]`/`foods[]`/`pheromones Map` ⇔ typed array の変換を、構造変化時(アリ数変更・food追加削除・world size変更)のみ実施
- `useSimulation.ts` はこの`adapter.step()`を呼ぶだけに簡略化

### 描画用の読み取りビュー(zero-copy)

`SimulationCanvas.tsx`は描画のたびにZustandの`ants[]`/`foods[]`/`pheromones Map`へ変換し直すのではなく、WASM linear memory上のtyped arrayを直接読む読み取り専用ビューを使う。「WASMが描画する」のではなく、「JSが描画に使うデータをWASMのバッファから直接読む」だけの変更であり、adapter層に描画用のビューを一つ追加する程度で済む。

- `adapter.getRenderView()`が以下を返す(すべて`instance.exports.memory.buffer`上のzero-copyビュー):
  - アリ: `antX` / `antY` / `antDirection`(`Float64Array`)、`antHasFood`(`Uint8Array`)、`antCount`
  - フード: `foodX` / `foodY` / `foodAmount`(`Float64Array`)、`foodCount`
  - フェロモン: `pheromoneToFood` / `pheromoneToNest`(`Float64Array`、密グリッド)、`gridWidth` / `gridHeight` / `cellSize`
- **既存コードの副次的な簡略化**: 現在`SimulationCanvas.tsx`は毎フレーム`pheromones`(Map)から`useMemo`で独自の空間インデックス(`pheromoneGrid`)を再構築しているが、フェロモンがWASM側で最初から密なグリッド配列になるため、この再インデックス処理は丸ごと不要になり削除できる
- 副次的に、`drawAnts`が毎フレーム`ants.filter()`で配列を2回複製している箇所も、生のtyped arrayを1パス走査してhasFoodで分岐する形に置き換えられ、無駄なアロケーションが減る
- **注意(WASMメモリ成長との整合性)**: WASM linear memoryが`grow`すると既存の`ArrayBuffer`はdetachされ、古いtyped arrayビューは無効になる。そのため`getRenderView()`は呼び出しのたびに(=毎フレーム)新しいビューを取得する実装とし、フレームをまたいでビューをキャッシュしない

## エラーハンドリング

- パリティ確認後に旧TS実装を削除する方針のため、恒久的なフォールバックエンジンは持たない
- WASM初期化(起動時1回)に失敗した場合はUIにエラー表示し、シミュレーション開始を不可にする

## 既存TS実装の扱い

パリティ確認後に削除する。二重実装を恒久的に残さず、シンプルに保つ。

## テスト戦略

各フェーズは**TDD(テストファースト)**で進める(`superpowers:test-driven-development`スキルに準拠)。

### Phase 0: 現状TS実装のテスト強化(移行の前提固め)

現状、`src/lib/aco/`配下で単体テストが存在するのは`ant-behavior.test.ts`のみ。今回ポート対象となる`geometry.ts`/`movement.ts`/`collision.ts`/`pheromone.ts`/`pathfinding.ts`には個別の単体テストが無く、MoonBit移植時の「正解データ」が揃っていない。移行に着手する前に以下を行う:

1. **重複ロジックの一本化**: `simulation-engine.ts`(`executeSimulationStep`)と`useSimulation.ts`内のインライン処理(`processAnts`/`applyUpdates`)が同じ役割を重複して持っている。`useSimulation.ts`が`simulation-engine.ts`の`executeSimulationStep`を呼ぶ形に統一する
2. **単体テストの新規作成**(決定的な入出力をテーブル化して仕様として固定):
   - `geometry.test.ts`(`torusDistance`/`torusWrap`/`normalizeAngle`)
   - `movement.test.ts`(`moveAnt`/`moveTowardsTarget`/`moveWithBias`)
   - `collision.test.ts`(`avoidCollisions`)
   - `pheromone.test.ts`(`depositPheromone`/`decayPheromones`/`getPheromoneStrength`)
   - `pathfinding.test.ts`(`followPheromone`/`findNearestTarget`/`getTargetsInRadius`)
   - `simulation-engine.test.ts`(一本化後の`executeSimulationStep`)
3. テストで見つかった既存挙動の疑問点・バグらしき箇所はこの時点で洗い出し、意図を確認する

### Phase 1以降: MoonBit移植時のテスト

1. **MoonBit側**: 各モジュール(`geometry.mbt`/`mt19937.mbt`/`pheromone.mbt`/`movement.mbt`/`collision.mbt`/`pathfinding.mbt`/`step.mbt`)は実装前に`*_test.mbt`を先に書く
   - 決定的な関数はPhase 0で作成したTSテストの入出力テーブルをMoonBit側のテストケースとして先に書き起こし、それに合格するまで実装する(数値一致を仕様として固定)
   - 乱数を含む関数は、乱数部分を除いた不変条件(境界内に収まる、angleの正規化範囲、PRNGのシード再現性など)を先にテストとして書く
2. **JS側アダプタ**: `adapter.ts`のtyped array変換も先にユニットテストを書いてから実装(構造変化時のリサイズ・境界値・空配列などのケースを含む)
3. **統合テスト**: WASMモジュールをロードして数ステップ実行するテストを、`useSimulation.ts`差し替え前に用意し、パリティ確認の判定基準として使う
4. 各移行ステップは「テスト作成 → 失敗確認 → MoonBit実装 → パス確認」を1サイクルとして進める
5. パリティ確認後、旧TS実装とそのテストを削除

## 運用面の既知の懸念

`moon` CLIは現状miseで管理できない(miseにmoonbitプラグインが存在しない)。今回のスコープでは`mise.toml`でのバージョン固定は行わず、READMEに手動インストール手順を明記するにとどめる。

## 移行順序(概要)

0. 現状TS実装のテスト強化(上記Phase 0) — 完了
1. 最小スパイク(Hello World → wasm-gc/wasm ビルド → Viteロード検証)で技術リスクを潰す — 完了(`wasm`(非GC)採用確定、詳細は上記「要検証事項」参照)
2. `geometry`のポート+テスト(依存最小)
3. `mt19937`(PRNG)のポート+テスト(`movement`が乱数に依存するため先行させる)
4. `pheromone`(密グリッド化含む)のポート+テスト
5. `movement`/`collision`のポート+テスト
6. `pathfinding`/`ant-behavior`統合、`step()`実装
7. `adapter.ts`実装(描画用read viewを含む)、`useSimulation.ts`/`SimulationCanvas.tsx`置き換え
8. パリティ確認 → 旧TS実装削除
