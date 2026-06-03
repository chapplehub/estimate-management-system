# Issue #293 実装計画からの逸脱記録

## 逸脱1: コマンドによる子エンティティ直接構築 → EstimateFactory 新設

### 元の計画内容（Step 4.2）
- アプリケーション層の `CreateEstimateCommand` 内で `EstimateItem.create()` →
  `EstimateVariation.create()` を直接呼び、子集約を構築する想定だった。

### 実際の実装内容
- `src/server/subdomains/estimate/domain/entities/EstimateFactory.ts` を新設し、
  「VO 記述子 → 子エンティティ → 集約ルート Estimate」の組み立てをドメイン（集約内）に
  閉じ込めた。
- コマンドは `primitive → VO 変換`＋VO 記述子の構築までを担当し、
  `EstimateFactory.create(...)` を呼ぶだけにした。
- 計画 Step 4 を Step 4a（EstimateFactory + 純ドメインテスト）と Step 4b
  （CreateEstimateCommand）の 2 コミットに分割した。

### 逸脱の理由
- `eslint.config.mjs` の `no-restricted-imports` が Estimate 集約の子エンティティ
  （EstimateVariation / EstimateItem / RepairEstimateDetail /
  AfterRepairEstimateDetail / RevisedEstimateItemDetail）を**集約外から直接 import
  することを禁止**している（例外は `entities/**` と `EstimateMapper.ts` のみ）。
  application 層のコマンドは集約外であり、計画どおり子エンティティを直接 new すると
  ESLint エラーになる。計画策定時にこの集約境界規約が考慮されていなかった。
- 対応方針はユーザー確認により決定（案A2）: ESLint 例外をコマンドに追加する
  （穴を増やす）案ではなく、子エンティティ構築という集約内責務を `EstimateFactory`
  （entities/ 配下）へ閉じ込め、コマンドからは VO で構成した記述子を渡す方式を採用。
  これにより集約境界規約を一切崩さず、既存コマンド規約（Input はプリミティブ、
  command 内で VO 変換）とも対称性を保てる。
- `EstimateFactory` はバレル（entities/index.ts）から公開するが、入出力は VO 記述子と
  集約ルート Estimate のみで子エンティティ型を露出しないため、境界規約を損なわない。

## 逸脱2: 採番方式の取得実装（aggregate → findFirst）

### 元の計画内容
- `PrismaEstimateNumberIssuer` は `MAX(sequence)+1` で採番する（計画本文の表現は
  「MAX(sequence)」）。実装イメージとして集約関数 `aggregate({ _max })` を想定していた。

### 実際の実装内容
- `findFirst({ orderBy: { sequence: "desc" }, select: { sequence: true } })` で
  最大連番を取得する形にした（論理は MAX+1 のまま）。

### 逸脱の理由
- Prisma の `aggregate({ _max: {...} })` の `_max` キーが ESLint
  `@typescript-eslint/naming-convention`（オブジェクトリテラルプロパティは camelCase /
  UPPER_CASE）に抵触する。`findFirst + orderBy` は規約に適合し、かつ「最大連番1行を取る」
  という意図も読みやすいため採用した。採番ロジック（年度×種別での最大連番+1）は不変。
