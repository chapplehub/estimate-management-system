# 作業タイプ リファレンス

Issue / ブランチ / PR / コミットの 4 文脈にまたがる**作業タイプのマスターテーブル**。
各スキル（create-issue, auto-dev, finalize-work 等）はこのファイルを参照すること。

> [!IMPORTANT]
> **文脈ごとに使える値の集合が異なる。** 列を取り違えると、commitlint が拒否する type を
> コミットに使ったり、存在しないラベルを付与しようとして `gh` が失敗したりする。
> 用途に対応する列を見ること。

## マッピングテーブル

| type | Issue | branch | commit | label | keywords |
|------|-------|--------|--------|-------|----------|
| feat | `feat:` | `feat/` | `feat:` | `Type: enhancement` | 機能追加, 実装, 新規, 追加 |
| fix | `fix:` | `fix/` | `fix:` | `Type: bug` | バグ, エラー, 不具合, 修正 |
| refactor | `refactor:` | `refactor/` | `refactor:` | `Type: refactor` | リファクタ, 整理, 削除, cleanup, 統合, 分離 |
| docs | `docs:` | `docs/` | `docs:` | `Type: documentation` | ドキュメント, 記録, README |
| test | `test:` | `test/` | `test:` | `Type: test` | テスト, カバレッジ, spec |
| ci | `ci:` | `ci/` | `ci:` | `Type: ci` | CI, pipeline, deploy, lint |
| agent | `agent:` | `agent/` | `agent:` | `Type: agent` | hook, skill, AI設定, CLAUDE.md, rules |
| build | `build:` | `build/` | `build:` | — | ビルド, webpack, バンドル, 依存関係 |
| chore | `chore:` | `chore/` | `chore:` | — | 雑務, メンテナンス |
| perf | `perf:` | `perf/` | `perf:` | — | パフォーマンス, 高速化, 最適化 |
| style | `style:` | — | `style:` | — | フォーマット, 整形, スタイル |
| revert | `revert:` | — | `revert:` | — | 取り消し, 巻き戻し, revert |
| question | `question:` | — | ❌ `docs:` を使う | `Type: question` | 疑問, 検討, 方針, 議論, 質問, どうすべき |
| architecture | `arch:` | — | ❌ `docs:` を使う | `Type: architecture` | アーキテクチャ, 設計判断, 設計方針 |

## 各列の意味

- **Issue**: Issue タイトルの接頭辞
- **branch**: ブランチ名の接頭辞（`{branch}issue-{number}` 形式）。`—` はブランチ作成対象外
- **commit**: コミットメッセージの接頭辞。**`commitlint.config.mjs` の `type-enum` が正**であり、❌ の type は commit-msg フックが拒否する
- **label**: GitHub Issue に付与するラベル。`—` は付与不要（対応するラベルが存在しない）
- **keywords**: Issue 作成時のタイプ自動判定に使用するキーワード

## 注意点

### PR タイトルは commit 列に従う

GitHub の squash merge は**コミットメッセージに PR タイトルをそのまま使う**ため、PR タイトルは事実上コミットメッセージになる。
`question` / `architecture` の Issue から作った PR であっても、**PR タイトルには `docs:` を使う**こと。

なお PR タイトルを検証する CI は無く、`commit-msg` フックも通らない。ここは規約でしか守れない。

### label が `—` の type

`build` / `chore` / `perf` に対応する GitHub ラベル（`Type: build` 等）は**存在しない**。
`gh issue create --label` にこれらを渡すとコマンドが失敗するため、ラベルを指定せずに起票する。

### 依存更新

Renovate が `:semanticCommitTypeAll(chore)` で生成するため、**type は `chore`、`deps` は scope**（`chore(deps): ...`）。
`deps` type は存在しない（`type-enum` から削除済み）。
`dependencies` ラベルは Renovate が自動付与するので手動で付けない。

### type と label の名前のずれ

`feat` ↔ `Type: enhancement`、`fix` ↔ `Type: bug` のように名前が異なるものがあるが、これはエコシステムの違いによる正常なずれ。

## コミットメッセージの書き方

規範は `CLAUDE.md` の「Commit Rule」節にある。ここでは書き方の例を示す。

### 設計判断をボディに書く

コミット対象に設計判断（実装方式の選択、レイヤー配置、データ構造の決定など）が含まれる場合、**その判断理由**をボディに記載する。何をしたかではなく、なぜその選択をしたかを書く。

```
feat: 社員コードの重複チェックを追加

バリデーションをドメイン層ではなくアプリケーション層に配置。
理由: 外部API依存のチェックを含むため。
```

```
refactor: 承認ステップの保持方法を配列に変更

Mapではなく配列で管理。
理由: 要素数が常に少なく、順序保証が必要なため。
```

判断理由が無いコミット（typo 修正、フォーマット、依存の追従など）にまで理由を書く必要はない。
