# aco_core (spike)

MoonBit/WASM移行の技術検証(Phase 1スパイク)用の最小プロジェクト。
`docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md` の
「要検証事項」を解消するために作成した。

## 検証内容と結論(2回目のスパイクで確定)

1回目のスパイク(`moonbit-spike`ブランチ)では`wasm-gc`採用と結論したが、
SoA/zero-copy設計の核心である「JS側からWASMの線形メモリをtyped arrayとして
直接読み書きできるか」を追加検証した結果、**`wasm`(非GC)ターゲットに変更した**。

- **`wasm-gc`では、`FixedArray[Double]`等の戻り値がJSから見て不透明な参照
  (`[Object: null prototype] {}`)になり、線形メモリ経由でtyped arrayとして
  直接読めない**ことを実機で確認した(WasmGC提案の仕様上、GC管理オブジェクトは
  ホストに対して不透明であるため、ツールチェインのバージョンに依らない制約)
- **`wasm`(非GC)ターゲットでは、`FixedArray[Double]`を返す関数の戻り値が
  生のi32ポインタ(線形メモリオフセット)になり、`new Float64Array(memory.buffer, ptr, length)`
  でゼロコピーに読める**ことを実機で確認した。同様に、そのポインタを引数として
  別のMoonBit関数にそのまま渡すことも確認済み(`sum_array`関数で往復動作を確認)
- ポインタの生存期間は参照カウント方式のGCに依存する。同一フレーム内で
  「呼び出し→即座に読み取り」する分には問題ないことを確認したが、フレームを
  またいで古いポインタを保持し続ける設計は避けること
- **ビルド設定**: `moon.pkg.json`(JSON形式)の`link.wasm-gc.exports` +
  `export-memory-name`の組み合わせは、当初検証したツールチェイン
  (`moon 0.1.20260522`)で関数エクスポートが消えるバグがあった。
  `moon upgrade`で最新版(`moon 0.1.20260807`)に更新し、`moon.pkg`(DSL形式)
  + `pkgtype(kind: "foreign_library")` + `#export_name(...)`アトリビュート
  方式に切り替えたところ正しく動作した。**本プロジェクトはこの構成を採用する**
- プロジェクト名に`-`(ハイフン)は使えない(`moon new`がエラーになる)
- Viteは追加プラグイン無しで動作する(1回目のスパイクの結論のまま変更なし):
  `new URL("./x.wasm", import.meta.url)`パターンで静的アセットとして扱われ、
  配信時のMIMEタイプは自動的に`application/wasm`になる

## 未検証(ブラウザでの実地確認)

Node.js上での実行と、Viteの静的配信(MIMEタイプ含む)までは確認したが、
実ブラウザでの`WebAssembly.instantiateStreaming`実行までは本セッションでは
確認していない(ブラウザ拡張が利用不可だったため)。Phase 1本実装時に
一度ブラウザでの動作確認を行うことを推奨する。
