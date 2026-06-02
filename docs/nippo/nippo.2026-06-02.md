# 日報 2026 年06 月02 日

## 📝 作業ログ

### 14:07 - Issue #287 完了（リポジトリ interface 定義）

https://github.com/chapplehub/estimate-management-system/issues/287完了

ドメイン層に `EstimateRepository` interface を定義（着手順序 #5 前段）。
`save` / `delete` / `findById` / `findByEstimateNumber` を既存 `CustomerRepository` 規約に揃えて定義。検索・一覧は QueryService 側に分離する方針を JSDoc に明記。

### 18:18 - Issue #290 完了（Prisma 実装）

https://github.com/chapplehub/estimate-management-system/issues/290完了

`EstimateMapper` と `PrismaEstimateRepository` を infrastructure 層に実装（着手順序 #5 後段）。子エンティティ（Variation / Item ＋修理系）を含む集約のラウンドトリップ（`save → findById`）を実現。

---

## 🎯 今日の目標

- [x] 見積バックエンド着手順序 #5「リポジトリ層」を完了する（interface 定義 + Prisma 実装）

## 📊 進捗状況

**着手順序 #5（リポジトリ層）完了** — 前段・後段ともに本日クローズ。

| Issue | 内容 | 状態 |
|-------|------|------|
| #287 | `EstimateRepository` interface（ドメイン層） | ✅ 完了（14:07） |
| #290 | `EstimateMapper` / `PrismaEstimateRepository`（インフラ層） | ✅ 完了（18:18） |

- 集約ルート `Estimate` 単位の 1 リポジトリ（Vernon 規約: 集約ルートごとに 1 リポジトリ）として永続化境界を確定。
- `save → findById` のラウンドトリップで、子エンティティ（Variation / Item / 修理系）を含めて集約が等価に再構築されることを確認。
- これで後続のアプリ層ユースケース（着手順序 #6）が集約を永続化できる状態に到達。

## 💡 学びと気づき

- **集約境界規約と eslint の衝突**: `eslint.config.mjs` の `no-restricted-imports` が子エンティティ（`EstimateVariation` / `EstimateItem` 等）の直接 import を禁止している。一方で Mapper の `toDomain()`（= 集約再構築 `reconstruct()`）は子エンティティの生成を必要とする。両立のため `entities/internal.ts` 等の export 経路を設けて eslint 例外を整理する必要があった。
  - → 「集約の外からは子を触らせない」というドメイン規約を、再構築を担う infrastructure 層に対してだけ穴を開ける、という設計判断。境界の強制（lint）と再構築の必然性（mapper）のトレードオフ。
- **Customer との差分**: 既存 `customer` サブドメインは単一集約ルートだが、`Estimate` は子エンティティを持つ集約。`save`（nested create / update の差分反映）・`delete`（カスケード）・`findById`（子を include して再構築）すべてで子の扱いが追加論点になる。

## 🚀 明日への申し送り

- 次は **着手順序 #6: アプリ層ユースケース C1〜**。#290 で永続化境界が整ったため着手可能。
- Mapper の `toPrismaUpdate()` における子エンティティの差分反映方針（全削除→再作成か、差分 upsert か）が確定済みか、ユースケース実装前に再確認しておくとよい。
