# Issue #233: 意味のある編集・追加をした時点でコミットをするルールをCLAUDE.mdに設ける — 実装計画

## 概要

CLAUDE.mdの「コミットをこまめに作る」ルールが現在plan mode限定になっている。これを汎用ルールに昇格させ、コード編集・追加時に常に適用されるようにする。加えて、設計判断のWHYをコミットボディに記録するルールを新設する。

## 問題の背景

現在のCLAUDE.mdでは `## Implementation Workflow` セクション内に以下のように記載されている:

```
When implementing with a plan (plan mode), follow these rules:
- Commit at each plan step: Create a commit when each step of the plan is completed.
```

この書き方では「plan modeの場合のみ」こまめにコミットする、と解釈される。実際にはコードベースに編集・追加があったときは常にこまめにコミットすべきルールであるため、plan modeのスコープから切り出す必要がある。

## 設計判断

### コミットルールの配置場所
- A. `## Git Branch Strategy` の直後に新セクション `## Commit Rule` を追加
- B. `## Git Branch Strategy` セクション内にコミットルールも含める
- 推奨: A（ブランチ戦略とコミット規律は関連するが別の関心事。セクションとして独立させた方が見つけやすい）

### コミットボディルールのアプローチ
- A. 計画の有無・逸脱で3パターンに場合分け
- B. 「設計判断があればコミットボディに書く」の統合ルール + 具体例
- 推奨: B（シンプルで漏れにくい。具体例で判断基準を明確にする）

### deviations.md との関係
- コミットボディ: 個々の設計判断のWHY（コミット単位のピンポイント記録）
- deviations.md: PR全体の逸脱サマリ（俯瞰的な記録）
- 粒度が異なるため両方に書く

## 変更方針

### 1. 新セクション `## Commit Rule` を追加

`## Git Branch Strategy` と `## Issue, PR Creation` の間に配置。

```markdown
## Commit Rule

- **Commit at each meaningful change**: コードの編集・追加をしたら、意味のあるまとまりの時点でコミットする。一括実装してまとめてコミットしない。
- **Record design decisions in commit body**: コミット対象に設計判断（実装方式の選択、レイヤー配置、データ構造の決定など）が含まれる場合、その判断理由をコミットボディに記載する。
  - 例: 「バリデーションをドメイン層ではなくアプリケーション層に配置。理由: 外部API依存のチェックを含むため」
  - 例: 「Mapではなく配列で管理。理由: 要素数が常に少なく、順序保証が必要なため」
- Commit types: `.claude/references/commit-types.md` を参照
```

### 2. `## Implementation Workflow` を `## Plan Mode Workflow` にリネーム

- セクション名を変更してスコープを明確にする
- 導入文を `計画ファイルを使って実装する場合（plan mode）のルール:` に変更
- 「Commit at each plan step」の箇条書きを削除（汎用ルールに移動済み）
- 残る箇条書き: Plan file format, Record deviations from plan

### 変更後のセクション構成

```
# CLAUDE.md
## Tech Stack            （変更なし）
## Commands              （変更なし）
## Git Branch Strategy   （変更なし）
## Commit Rule           （新規追加）
## Issue, PR Creation    （変更なし）
## Plan Mode Workflow    （リネーム + コミットルール削除）
## Critical: DDD Layering Rules  （変更なし）
## E2E Tests             （変更なし）
## Reference             （変更なし）
```

## ステップ

### Step 1: CLAUDE.mdの改修
- 対象ファイル: `CLAUDE.md`
- 作業内容:
  - `## Git Branch Strategy` と `## Issue, PR Creation` の間に `## Commit Rule` セクションを挿入
  - `## Implementation Workflow` を `## Plan Mode Workflow` にリネーム
  - 導入文を変更
  - 「Commit at each plan step」箇条書きを削除
- コミットメッセージ: `agent: コミットルールをplan mode限定から汎用ルールに昇格 (#233)`
- コミットハッシュ: `e24c0addeccd8bdd41236222737daf3f44ca803f`

## 検証方法

- CLAUDE.mdの変更後、Claude Codeの新しいセッションでコードを編集する指示を出し、plan mode以外でもこまめなコミットと設計判断のボディ記載が行われるか確認する

## 影響範囲の確認

- **Hookへの影響**: `pre-bash-plan-reminder.sh`, `post-bash-commit-fail-check.sh` 等のhookはCLAUDE.mdのセクション名を参照していないため影響なし
- **Skillへの影響**: `auto-dev`, `auto-implement` 等のskillはCLAUDE.mdを直接参照して動作するため、ルールが汎用化されれば自動的にplan mode以外でも適用される
- **settings.jsonへの影響**: 変更なし
