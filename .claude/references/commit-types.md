# Commit Type リファレンス

commit type, GitHub label, branch prefix の対応関係を定義するマスターテーブル。
各スキル（create-issue, auto-dev, finalize-work 等）はこのファイルを参照すること。

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

## commitlint との差異

**commit-msg フックが実際に許可する type は `commitlint.config.mjs` の `type-enum` が正**であり、上の表とは一致しない。

- 表にあるが commitlint が**拒否する**: `question`, `architecture`（`arch:`）
  → 設計判断・方針の記録をコミットしたい場合は `docs:` を使う
- commitlint にあるが表に無い: `deps`

上の表は Issue のラベル付け・ブランチ命名を含む対応関係のマスターであり、コミット時は commitlint 側の制約が優先される。

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
