# aco_core (spike)

MoonBit/WASM移行の技術検証(Phase 1スパイク)用の最小プロジェクト。
`docs/superpowers/specs/2026-08-12-aco-core-wasm-migration-design.md` の
「要検証事項」を解消するために作成した。

## 検証内容と結論

- `moon build --target wasm` / `--target wasm-gc` はどちらも問題なくビルドできる
- **`wasm-gc` を採用する**(設計通り)。Node.js v24 で追加のimportなしにロード・実行できることを確認済み(WasmGCはNode 22+/evergreenブラウザで標準サポート)
- `pub fn` は `moon.pkg.json` の `link.wasm-gc.exports` に列挙するだけでWASMのexportに現れる。追加のグルーコード生成は不要
- Vite側は追加のプラグイン無しで動作する: `new URL("./x.wasm", import.meta.url)` パターンで静的アセットとして扱われ、小さいファイルはdata URLにインライン化、大きいファイルはハッシュ付きファイルとして出力される。どちらの経路でも配信時のMIMEタイプは自動的に `application/wasm` になり、`WebAssembly.instantiateStreaming` がそのまま使える
- **プロジェクト名に `-`(ハイフン)は使えない**(`moon new` がエラーになる)。設計ドキュメントの `moonbit/aco-core/` は `moonbit/aco_core/`(アンダースコア)に修正が必要
- このインストール済みツールチェイン(`moon 0.1.20260522`)は `moon.mod`/`moon.pkg`(TOML風の独自DSL)をデフォルトで生成するが、`moon.mod.json`/`moon.pkg.json`(JSON)も引き続きサポートされている。`link.wasm-gc.exports` 等の設定例が `~/.moon/AGENTS.md` にJSON形式でドキュメント化されているため、本プロジェクトでは **JSON形式を採用する**

## 未検証(ブラウザでの実地確認)

Node.js上での実行と、Viteの静的配信(MIMEタイプ含む)までは確認したが、実ブラウザでの`WebAssembly.instantiateStreaming`実行までは本セッションでは確認していない(ブラウザ拡張が利用不可だったため)。WasmGCは2026年時点でevergreenブラウザに広く普及しているため残存リスクは低いと判断するが、Phase 1本実装時に一度ブラウザでの動作確認を行うことを推奨する。
