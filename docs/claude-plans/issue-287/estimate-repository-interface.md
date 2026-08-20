# Issue #287: EstimateRepository インターフェース（ドメイン層）を定義する（着手順序 #5 前段） — 実装計画

## コンテキスト

見積バックエンド着手順序 #5「リポジトリ interface」の前段。#285（着手順序 #4）で
`Estimate → EstimateVariation → EstimateItem` 集約が実装完了したため、その永続化境界と
なる `EstimateRepository` インターフェースをドメイン層に定義する。

これにより、後続のアプリ層ユースケース（着手順序 #6）が「永続化の実体（Prisma）を知らずに」
集約を保存・取得できるようになる。Prisma マッパー・`PrismaEstimateRepository` 実装
（着手順序 #5 後段）、アプリ層ユースケース（着手順序 #6）は **別イシュー**。

本イシューの成果物は **ドメイン層の interface 定義 1 ファイルのみ**。

## 概要

- 新規ファイル: `src/server/subdomains/estimate/domain/repositories/EstimateRepository.ts`
- 集約ルート `Estimate` 単位の 1 リポジトリ（Vernon: 集約ルートごとに 1 リポジトリ）。
  子エンティティごとには作らない。
- 既存 `CustomerRepository`（`src/server/subdomains/customer/domain/repositories/CustomerRepository.ts`）
  の規約に揃える。メソッド構成は `save` / `delete` / `findById` + ドメイン固有 finder の 4 つ。
- 検索・一覧取得は本 interface に含めず QueryService 側へ分離する旨を JSDoc に明記する。

### メソッドシグネチャ

| メソッド | シグネチャ | 用途 |
|----------|-----------|------|
| `save` | `save(estimate: Estimate): Promise<Estimate>` | 新規作成・更新を兼ねる |
| `delete` | `delete(id: EstimateId): Promise<void>` | ID 指定削除 |
| `findById` | `findById(id: EstimateId): Promise<Estimate \| null>` | ID 取得 |
| `findByEstimateNumber` | `findByEstimateNumber(estimateNumber: EstimateNumber): Promise<Estimate \| null>` | 採番一意性チェック等 |

### 参照する型と import 経路

- 集約ルート: `Estimate` — **バレル `@subdomains/estimate/domain/entities` 経由**で import する。
  - 根拠: `eslint.config.mjs` L58-71 が子エンティティ（`EstimateVariation` / `EstimateItem` 等）の
    直接 import を `no-restricted-imports` で禁止しており、集約ルートはバレルからのみ公開される規約。
    これにより issue 要件「子エンティティを直接 import しない」が機械的に保証される。
- 値オブジェクト:
  - `EstimateId` — `@subdomains/estimate/domain/values/EstimateId`
  - `EstimateNumber` — `@subdomains/estimate/domain/values/EstimateNumber`
- 子エンティティ（`EstimateVariation` / `EstimateItem` / 修理詳細群）は **import しない**。

## 設計判断

### 集約ルート `Estimate` の import 経路: バレル vs 直接パス
- A. バレル `@subdomains/estimate/domain/entities` 経由（`CustomerRepository` は直接パスだが、
  estimate サブドメインは eslint で集約境界を強制している）
- B. 直接パス `@subdomains/estimate/domain/entities/Estimate`
- **推奨: A**。estimate entities バレルは集約ルートのみを公開する設計であり、その公開経路を
  使うことが集約境界規約の意図に沿う。`CustomerRepository` が直接パスを使うのは customer に
  同等の eslint 制約が無いためで、本サブドメインでは A が正しい。

### ドメイン固有 finder の範囲
- `findByEstimateNumber` のみとする。
- 根拠: 採番一意性チェック（重複検出）に必要。`CustomerRepository.findByCode` と対応する
  最小構成。一覧・検索系（顧客別・期間別等）は QueryService 責務であり本 interface に含めない。

### テストの要否
- 新規テストは不要（interface のみ、実装を持たない）。
- 型レベルの整合は `pnpm lint`（tsc 型チェック）で検証される。

## ステップ

### Step 1: EstimateRepository インターフェースを定義する
- 対象ファイル: `src/server/subdomains/estimate/domain/repositories/EstimateRepository.ts`（新規）
- 作業内容:
  - `repositories/` ディレクトリを新規作成し、`EstimateRepository.ts` を追加する。
  - `CustomerRepository` の JSDoc・構造を踏襲し、interface `EstimateRepository` を定義する。
    - メソッド: `save` / `delete` / `findById` / `findByEstimateNumber`（上表のシグネチャ）。
    - interface 冒頭の JSDoc に「検索・一覧取得については EstimateQueryService を使用すること」を明記。
    - 各メソッドに簡潔な JSDoc を付与する。
  - import:
    - `Estimate` ← `@subdomains/estimate/domain/entities`（バレル）
    - `EstimateId` ← `@subdomains/estimate/domain/values/EstimateId`
    - `EstimateNumber` ← `@subdomains/estimate/domain/values/EstimateNumber`
  - Prisma / Next.js / 外部ライブラリは import しない（DDD レイヤリング規約）。
- コミットメッセージ:
  `feat: 見積集約の永続化境界 EstimateRepository interface をドメイン層に定義する (#287)`
  - ボディに設計判断（集約ルートをバレル経由で import / 検索系は QueryService 分離）を記載する。

## 検証

- `pnpm lint` — 型チェック（tsc）と eslint の `no-restricted-imports` 違反が無いことを確認。
  集約境界規約（子エンティティ直接 import 禁止）に違反していればここで検出される。
- `pnpm test` — 既存テストが全て通ること（interface 追加のみのため新規テストは無し）。
- 目視確認: `EstimateRepository` が `domain/repositories/` 配下に存在し、メソッドシグネチャが
  `CustomerRepository` の規約と一貫していること、外部依存の import が無いこと。

## このイシューに含めないこと（別イシュー）

- Prisma マッパー・`PrismaEstimateRepository` 実装（着手順序 #5 後段）
- `reconstruct()` のための子エンティティ export 経路（`entities/internal.ts` 等）の決定
  （issue-284 計画 設計判断 6）— Prisma 実装の `toDomain()` 側で必要になる課題。本イシューでは不要。
- アプリ層ユースケース C1〜（着手順序 #6）
