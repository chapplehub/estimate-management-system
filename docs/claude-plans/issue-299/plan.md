# 実装計画 — #299 税率チェック(§8.7)横断ポリシーと TaxRate マスタのドメイン実装

> 本計画は #299 のグリルセッションで詰めた設計判断（PRD 本文に反映済み）を、TDD 実装手順に落としたもの。
> PRD: https://github.com/chapplehub/estimate-management-system/issues/299

## 前提・作業方針

- 作業ブランチ: `feat/issue-299`（worktree なし、現ブランチで直接作業）
- 進め方: TDD 垂直スライス（1テスト → 1実装の往復）。**横断スライス（全テスト先書き）禁止**。
- ビルド順: 既存規約「VO → エンティティ → リポジトリ → サービス」のボトムアップ。

## 確定済み設計判断（グリルより）

1. **Policy ではなく DomainService**。リポジトリ依存が不可避（ADR-0023 の Policy 定義に反する）→ `domain/services/`、ADR-0011 の事実確認型（結果を返す）。
2. **配置は estimate サブドメイン配下**（既存 `TaxRate` VO と同居。横断昇格は受注着手時に再判断）。
3. **エンティティ名 `TaxRateMaster`**（設計書「消費税率マスタ」語彙）。フィールド: `id: TaxRateMasterId`、`rate: TaxRate`(既存VO)、`effectiveFrom: Date`(plain)。
4. **`reconstruct()` のみ**。`create()`/UUIDv7 採番は管理画面イシュー（スコープ外）。`TaxRateMasterId` も `generate()` を付けない（UUIDv7 形式バリデーションのみ継承）。
5. **`TaxRateRepository.findEffectiveAt(date): Promise<TaxRateMaster | null>`**。Prisma 実装は `effectiveFrom <= date ORDER BY effective_from DESC LIMIT 1`（境界 lte=等値を含む）。
6. **null の責務分離**: リポジトリは `null` 返し、DomainService が `null → BusinessRuleViolationError` throw（想定外パニック）。
7. **`TaxRateConsistencyCheckDomainService.check({estimateDate, deadline})`**。`TaxRate.equals` で比較。
8. **戻り値は判別可能ユニオン**:
   ```ts
   type TaxRateCheckResult =
     | { kind: "consistent"; rate: TaxRate }
     | { kind: "mismatch"; estimateDateRate: TaxRate; deadlineRate: TaxRate }
   ```
   null はユニオンに含めず throw。

## TDD サイクル

| # | seam | 振る舞い | 種別 |
|---|---|---|---|
| 1 | `TaxRateMaster`(+`TaxRateMasterId`) | reconstruct した値が getter で取れる（`rate` は TaxRate VO） | 単体 |
| 2 | `PrismaTaxRateRepository.findEffectiveAt` | 最新行より後の日付 → 最新税率(0.100)（tracer: IF+impl+mapper 誕生） | 実DB結合 |
| 3 | 〃 | `effectiveFrom` と同日(2014-04-01) → 0.080（lte は等値を含む） | 実DB結合 |
| 4 | 〃 | 2行の中間日(2018) → 前の行 0.080 | 実DB結合 |
| 5 | 〃 | 最古行より前(2013) → `null` | 実DB結合 |
| 6 | `TaxRateConsistencyCheckDomainService` | 両日付が同一税率期間 → `{kind:"consistent", rate:0.100}`（tracer: service+結果型 誕生） | 実DB結合 |
| 7 | 〃 | 2019-10-01 をまたぐ → `{kind:"mismatch", estimateDateRate:0.080, deadlineRate:0.100}` | 実DB結合 |
| 8 | 〃 | 適用税率なし(2013) → `BusinessRuleViolationError` throw | 実DB結合 |

最後に refactor パス（重複抽出・モジュール深化）。

## テスト方針

- 既存 seam のみ使用。新規 seam ゼロ。最高位 seam で検証。
- **マッパーはリポジトリ結合テスト(#2-5)で担保**（独立単体テストは作らない＝最高位 seam 原則）。
- テストデータは**シード史実2行**（2014-04-01→0.080, 2019-10-01→0.100）を使用、新規 INSERT しない。
  - 一致: 両日付 ≥ 2019-10-01 / 不一致: 2019-10-01 をまたぐ / null: < 2014-04-01
  - テスト先頭にシード前提コメント（将来のトリップワイヤ）。
- 実DB結合テストの prior art: `PrismaEstimateNumberIssuer.test.ts`、`CustomerCodeDuplicationCheckDomainService.test.ts`。

## スコープ外

§A.1 税率自動設定 / 受注時チェック(3日付) / #294 への組み込み / 税率マスタ管理画面・CRUD（→ `create()`/`generate()` も対象外）/ 設定税率不正チェック / shared 昇格。

## 受け入れ条件

- エンティティ・IF・Prisma実装・マッパー・DomainService・各テストが `pnpm test` / `pnpm lint` 通過
- DDD レイヤリング遵守（domain は Prisma 非依存、application は IF 経由）
- 日付→有効税率の解決が effectiveFrom 単調タイムラインのパターンで実装
