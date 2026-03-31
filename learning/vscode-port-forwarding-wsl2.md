# VSCode の Ports タブと WSL2 ポートフォワーディング

作成日: 2026-03-31

## 概要

VSCode の Ports タブに表示される5桁ポートの正体と、WSL2 環境でのポートフォワーディングの仕組み。

## なぜ5桁ポートが並ぶのか

VSCode は Remote-WSL 接続時に複数の node プロセスを立ち上げる（拡張ホスト、ファイルウォッチャー、TypeScript 言語サーバ等）。
それぞれがランダムな5桁ポートで内部通信するため、Ports タブに並ぶ。

## WSL2 のポートフォワーディング

WSL2 は仮想マシンなので Windows とは別のネットワークを持つ。
そのままだと Windows のブラウザから WSL2 のサーバにアクセスできない。

```
転送なしの場合:
  ブラウザ → localhost:3000 → 届かない

転送ありの場合:
  ブラウザ → localhost:3000(Windows) → VSCode が中継 → WSL2:3000 → Next.js
```

VSCode が自動的に WSL2 内の LISTEN ポートを検知し、Windows 側に転送（ポートフォワーディング）する。
この仕組みは SSH のポートフォワーディング（`ssh -L`）と同じ原理。

## `ss -tlnp` と VSCode Ports タブの違い

| | `ss -tlnp` | VSCode Ports タブ |
|--|--|--|
| 何を見ている | WSL2 内で今 LISTEN 中のポート | VSCode が転送した/しているポートの一覧 |
| 終了したプロセスのポート | 消える | 残ることがある |
| Windows 側の転送ポート | 見えない（別 OS） | 見える |

VSCode Ports タブの方が多く表示されるのは正常。
`ss` はカーネルのソケット情報を直接読むので「今本当に何が動いているか」の正確な情報源。

## LISTEN の2種類

| | 本体の LISTEN | 転送の LISTEN |
|--|--|--|
| 誰が | node, PostgreSQL 等 | VSCode |
| どこで | WSL2 側 | Windows 側 |
| 何をする | リクエストを処理する | リクエストを WSL2 に流す |

## 不要なポートの整理

- Ports タブで右クリック → 「Stop Forwarding Port」で転送エントリを削除できる
- 自動転送自体を無効化するには VSCode 設定で `"remote.autoForwardPorts": false`
- VSCode を閉じれば転送は全て切れる
