# aco-simulation

蟻コロニー最適化(ACO)アルゴリズムのシミュレーション。シミュレーションのホットパスはMoonBit(WebAssembly)で実装され、Reactアプリから利用する。

## ディレクトリ構成

```
aco-simulation/
├─ packages/
│  ├─ wasm-core/    # MoonBitソース。シミュレーションのホットパス(アリの行動計算・
│  │                 # フェロモン処理)を実装し、wasmにビルドする。dist/aco_core.wasm
│  │                 # はビルド成果物としてリポジトリにコミットされており、moon
│  │                 # ツールチェーンがなくてもアプリを動かせる。
│  └─ app/           # Reactアプリ本体。packages/wasm-core/dist/aco_core.wasmを
│                     # ロードしてシミュレーションを実行・描画する。
└─ mise.toml         # ツール・タスク管理
```

## 開発環境のセットアップ

このプロジェクトはツールバージョン・タスク管理に [mise](https://mise.jdx.dev/) を使用しています。

```bash
# ツール(bun, node)のインストール
mise install

# 依存関係のインストール
mise run install

# 開発サーバーの起動
mise run dev
```

その他のタスク一覧は `mise tasks` で確認できます(`build` / `lint` / `format` / `preview` / `test` / `test:bun` / `test:ui` / `test:coverage` / `build:wasm`)。

## MoonBitコアの変更

`packages/wasm-core/`配下のMoonBitソースを変更した場合は、[moon CLI](https://www.moonbitlang.com/download/)をインストールした上で以下を実行し、wasmビルド成果物を再生成してコミットする:

```bash
mise run build:wasm
```
