# Issue #282: 採番 `EstimateNumber` 値オブジェクト（§2 の形式・年度算出）を実装する — 実装計画

## Context

見積（Estimate）には一意な採番（例: `N2500001`）が必要で、その形式と年度算出ロジックはシステム設計書 §2「見積番号の採番ルール」で定義されている。採番ルールはビジネスルールであり、形式バリデーション・分解・年度判定を 1 箇所にカプセル化するため、ドメイン層に値オブジェクト（VO）として実装する。

`docs/business/estimate/ユースケース一覧(見積).md` のバックエンド着手順序:
1. ✅ Prisma スキーマ（完了）
2. ✅ 金額計算の値オブジェクト + 計算ポリシー（PR #281 で完了）
3. 🟢 **採番 `EstimateNumber` 値オブジェクト（§2 の形式・年度算出）** ← 本計画
4. ⬜ エンティティ/集約
5. ⬜ リポジトリ interface

本 Issue のスコープは「**払い出し済みの連番を受け取って組み立て・パース・分解する VO**」に限定する。連番（sequence）の払い出しは `fiscalYear + estimateType` 単位の横断ポリシーとしてリポジトリ層の責務であり、後続 Issue で実装する。

## 仕様（システム設計書 §2 抜粋）

- **形式**: `[接頭辞1文字][年度2桁][連番5桁]` = 計 8 文字（Prisma `estimate_number VARCHAR(8)`）
- **接頭辞**: `N`（新規）/ `R`（修理）/ `A`（事後修理）
- **年度**: 4 月始まり（2025-04-01〜2026-03-31 = 2025 年度）
- **連番**: 年度ごとリセット、欠番許容、5 桁ゼロパディング、`00001`〜`99999`
- **採番タイミング**: 見積保存時（C1 `CreateEstimate`）

## 設計判断

### 1. `FiscalYear` を独立 VO として `shared/domain/values/` に新設
年度は税率マスタ・締切管理・集計など横断的概念のため、`shared/domain/values/FiscalYear.ts` に配置。内部表現は **西暦 4 桁数値**（例: `2025`）として保持し、`toShortString()` で `"25"` を返す。2 桁数値で保持すると 100 年衝突時に世紀情報を失うため不採用。

### 2. TZ は JST 固定（VO 内で純関数化）
ドメイン層は外部依存禁止のため、`Date.getMonth()` 等のローカル TZ 依存メソッドは使わない。`date.getTime() + 9 * 60 * 60 * 1000` で UTC ミリ秒を JST 相当に正規化してから `getUTCMonth/getUTCFullYear` を使う。サーバ TZ や `process.env.TZ` 設定に影響されず、テストが決定的。

### 3. `EstimateType` を独立 VO として同時実装
Prisma の `EstimateType` enum（`NEW`/`REPAIR`/`AFTER_REPAIR`）と接頭辞（`N`/`R`/`A`）の対応はドメイン側で表現する必要がある（Domain 層は Prisma を import 不可）。`ProductCategory.ts` を規範として `private constructor` + `static readonly` パターンで列挙。
- **`from(value)`**: Prisma 値（永続化復元用）
- **`fromPrefix(prefix)`**: 採番形式の接頭辞用（`EstimateNumber.parse` から呼ぶ）
- **アクセサ**: `value` / `prefix` / `label`（"新規" / "修理" / "事後"、§1.1 業務用語）

### 4. `EstimateNumber` の公開ファクトリは `parse(text)` のみ
パーツからの生成（`issue` / `fromParts`）は本 Issue では持たない。連番払い出しはリポジトリ層の責務であり、ここに置くと採番カウンタの永続化との結合が漏れる。`parse` のみに絞ることで「保存済み採番値の検証・分解」という単一責務に閉じる。

### 5. 年度 2 桁→4 桁復元は `2000 + YY` 固定
Prisma `VarChar(8)` + 2 桁年度は構造的に 100 年（2000〜2099）が上限。現在日時依存のスライディングウィンドウは過去レコードの復元が時刻に依存しテストが脆くなるため不採用。固定マッピングを採用し **ADR は起票せず、コミットボディに判断理由を記録**する。

### 6. バリデーションは早期リターン（最初に検出した 1 原因のみエラー）
既存 VO（`CompanyCode` 等）の規範に合わせる。順序: **長さ → 全体パターン → 連番≧1**。

### 7. `ValueObject<T, U>` 基底クラスを直接継承
3 VO とも `src/server/shared/ValueObject.ts` のブランド型基底を直接継承する。`StringValueObject` は単純な「文字列＋正規表現」用途のため、構造分解（接頭辞・年度・連番）を持つ VO や数値表現の VO には適さない。`ProductCategory` / `Money` / `TaxRate` と同型。

## 参照する既存ファイル

- `src/server/shared/ValueObject.ts` — 基底クラス（継承）
- `src/server/shared/errors/DomainError.ts` — `ValidationError`（形式不正用、`InvalidArgumentError` ではない）
- `src/server/subdomains/product/domain/values/ProductCategory.ts` — enum 風 VO の規範（`EstimateType` で踏襲）
- `src/server/subdomains/estimate/domain/values/Money.ts` — 複雑系 VO の構造規範
- `docs/business/estimate/システム設計書(見積).md` §2 — 採番仕様
- `prisma/schema.prisma:422-446` — `EstimateType` enum と `estimate_number VARCHAR(8)`

## ステップ

依存関係: `FiscalYear` ← `EstimateNumber` → `EstimateType`。依存順に 3 コミットに分割（実装＋テストを 1 コミットにまとめる）。

### Step 1: `FiscalYear` 値オブジェクトを追加

- **対象ファイル**:
  - `src/server/shared/domain/values/FiscalYear.ts`（新規）
  - `src/server/shared/domain/values/__tests__/FiscalYear.test.ts`（新規）
- **作業内容**:
  - `ValueObject<number, "FiscalYear">` を継承、内部値は西暦 4 桁数値
  - `static from(date: Date): FiscalYear` — JST 正規化（UTC ms + 9h）後の月で 1-3 月なら `year - 1`、4-12 月なら `year`
  - `toShortString(): string` — 下 2 桁ゼロ詰め
  - `validate`: 整数チェック・範囲 1900〜2999
  - 公開定数 `FISCAL_START_MONTH = 4`
  - テスト: 正常系（境界値 3/31→4/1 を含む）／異常系（非整数・範囲外）／equals／`from` の JST 純関数性
- **コミットメッセージ**:
  ```
  feat: FiscalYear 値オブジェクトを追加する（§2）

  4月始まり年度を西暦4桁数値で保持する横断VOを shared/domain/values に追加。
  EstimateNumber の年度部および将来の年度横断機能（税率マスタ・締切管理等）で共有する。

  設計判断:
  - 内部表現: 西暦4桁数値（2025）。2桁数値は世紀情報を失うため不採用。
  - TZ: JST固定。UTCミリ秒 + 9hオフセット → getUTCMonth/Year で純関数化し
    実行環境TZ依存を排除（ドメイン層の外部依存禁止に従う）。
  - 配置: shared/domain/values。estimate以外でも年度を扱う可能性があるため。
  ```

### Step 2: `EstimateType` 値オブジェクトを追加

- **対象ファイル**:
  - `src/server/subdomains/estimate/domain/values/EstimateType.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/__tests__/EstimateType.test.ts`（新規）
- **作業内容**:
  - `ValueObject<string, "EstimateType">` を継承、`ProductCategory.ts` を規範に `private constructor` + `static readonly NEW/REPAIR/AFTER_REPAIR`
  - `static from(value)`: Prisma 値（`"NEW"`等）→ インスタンス（switch-case）
  - `static fromPrefix(prefix)`: `"N"`/`"R"`/`"A"` → インスタンス
  - アクセサ: `value` / `prefix` / `label`（"新規" / "修理" / "事後"）
  - テスト: 各インスタンス生成／`from`／`fromPrefix`（大文字固定）／`prefix`・`label` アクセサ／equals／異常系
- **コミットメッセージ**:
  ```
  feat: EstimateType 値オブジェクトを追加する（§2）

  Prisma の EstimateType enum と採番接頭辞 N/R/A の対応をドメイン側で保持する。

  設計判断:
  - ProductCategory パターン踏襲（private constructor + static インスタンス）。
  - from(value) は Prisma 値、fromPrefix(prefix) は採番形式の接頭辞という
    2系統入口を提供。EstimateNumber.parse は fromPrefix を使うことで
    接頭辞→Prisma値マッピングをこのVO内に集約する。
  - label アクセサ（「新規」/「修理」/「事後」）は §1.1 業務用語をドメイン側に保持。
  ```

### Step 3: `EstimateNumber` 値オブジェクトを追加

- **対象ファイル**:
  - `src/server/subdomains/estimate/domain/values/EstimateNumber.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/__tests__/EstimateNumber.test.ts`（新規）
- **作業内容**:
  - `ValueObject<string, "EstimateNumber">` を直接継承、`private constructor`
  - `static parse(text: string): EstimateNumber` — 唯一の公開ファクトリ
  - 正規表現 `/^[NRA]\d{7}$/` でパターン検証
  - バリデーション順序: 長さ8 → パターン → 連番≧1（`00000` 拒否）
  - アクセサ: `value` / `prefix` / `estimateType`（`EstimateType.fromPrefix`）/ `fiscalYear`（`new FiscalYear(2000 + YY)`）/ `sequence`（先頭ゼロ除去後の整数）
  - テスト: 正常系（`N2500001`/`R2500123`/`A2510500`、連番境界 1/99999、年度境界 00/99）／長さ違い／不正接頭辞（`X`、小文字 `n`）／連番00000／年度非数字／空白混入／全アクセサ／equals
- **コミットメッセージ**:
  ```
  feat: EstimateNumber 値オブジェクトを追加する（§2）

  採番済み見積番号（接頭辞1+年度2+連番5=計8文字）をパースして
  構造化された値オブジェクトに変換する。FiscalYear/EstimateType と協調。

  設計判断:
  - 公開ファクトリは parse(text) のみ。連番（sequence）払い出しはリポジトリ層の
    別ポリシー責務として本VOには持たせない（採番カウンタの永続化と原子性が必要）。
  - 年度2桁→4桁復元は 2000+YY 固定。VarChar(8) + 2桁年度は元来 100年制限の
    ある仕様であり、現在日時依存のスライディング解決は予測不能性のため不採用。
  - バリデーション順序: 長さ→パターン→連番≧1。「最初に検出した1原因のみ通知」
    で既存VO（CompanyCode等）の規範に合わせる。
  ```

## 移動・後処理

Plan mode 終了後、本ファイルを `docs/claude-plans/issue-282/plan.md` へ移動し、`.claude/settings.local.json` の `plansDirectory` を `docs/claude-plans/issue-282` に更新する（PreToolUse hook のリマインド）。

## Verification

各ステップ完了時:

```bash
pnpm lint
pnpm vitest run src/server/shared/domain/values/__tests__/FiscalYear.test.ts          # Step 1
pnpm vitest run src/server/subdomains/estimate/domain/values/__tests__/EstimateType.test.ts   # Step 2
pnpm vitest run src/server/subdomains/estimate/domain/values/__tests__/EstimateNumber.test.ts # Step 3
```

全ステップ完了後:

```bash
pnpm lint
pnpm test                      # 既存テストへの影響がないこと（ドメイン純粋追加のため影響しない想定）
pnpm exec tsc --noEmit         # 型エラーがないこと
```

## 受け入れ条件チェック（Issue 本文）

- [x] §2 で定義された採番形式に準拠して値オブジェクトが生成・検証できる → Step 3
- [x] 年度算出ロジックが §2 の仕様通りに動作する → Step 1（境界値 3/31・4/1 をテストで担保）
- [x] Domain 層のレイヤリングルール（外部依存禁止）を遵守 → Prisma/Next.js を import しない・JST は純関数で表現
- [x] 単体テストが追加され、グリーン → 各 Step で並行追加
