# Commit Type リファレンス

commit type, GitHub label, branch prefix の対応関係を定義するマスターテーブル。
各スキル（draft-issue, finalize-issue, auto-dev, create-pr 等）はこのファイルを参照すること。

## マッピングテーブル

| type | prefix | label | branch | keywords |
|------|--------|-------|--------|----------|
| feat | `feat:` | `Type: enhancement` | `feat/` | 機能追加, 実装, 新規, 追加 |
| fix | `fix:` | `Type: bug` | `fix/` | バグ, エラー, 不具合, 修正 |
| refactor | `refactor:` | `Type: refactor` | `refactor/` | リファクタ, 整理, 削除, cleanup, 統合, 分離 |
| docs | `docs:` | `Type: documentation` | `docs/` | ドキュメント, 記録, README |
| test | `test:` | `Type: test` | `test/` | テスト, カバレッジ, spec |
| ci | `ci:` | `Type: ci` | `ci/` | CI, pipeline, deploy, lint |
| agent | `agent:` | `Type: agent` | `agent/` | hook, skill, AI設定, CLAUDE.md, rules |
| build | `build:` | `Type: build` | `build/` | ビルド, webpack, バンドル, 依存関係 |
| chore | `chore:` | `Type: chore` | `chore/` | 雑務, メンテナンス |
| perf | `perf:` | `Type: perf` | `perf/` | パフォーマンス, 高速化, 最適化 |
| style | `style:` | `Type: style` | — | フォーマット, 整形, スタイル |
| revert | `revert:` | — | — | 取り消し, 巻き戻し, revert |
| question | `question:` | `Type: question` | — | 疑問, 検討, 方針, 議論, 質問, どうすべき |
| architecture | `arch:` | `Type: architecture` | — | アーキテクチャ, 設計判断, 設計方針 |

## 補足

- **prefix**: コミットメッセージ・PRタイトル・Issueタイトルの接頭辞
- **label**: GitHub Issue に付与するラベル。`—` のものはラベル付与不要
- **branch**: ブランチ名の接頭辞（`{branch}issue-{number}` 形式）。`—` のものはブランチ作成対象外
- **keywords**: Issue 作成時のタイプ自動判定に使用するキーワード
- commit type と GitHub label の名前が異なるもの（feat↔enhancement, fix↔bug）があるが、これはエコシステムの違いによる正常なずれ
