# Issue #436: Money 値オブジェクトを shared/domain/values へ昇格する — 実装計画

## 概要

`Money` / `Currency` 値オブジェクトを `src/server/subdomains/estimate/domain/values/` から
共有層 `src/server/shared/domain/values/` へ移動する純リファクタ。**挙動は一切変えない**
（差分は import パスのみ）。価値は前方互換で、後続の #426（pricing）の `SellingUnitPrice` が
shared の Money に依存するための先行前提（#436 は #426 の prerequisite）。

grill-with-docs の結果、移動で露呈する「概念的負債」（estimate スペック参照の JSDoc・JPY 専用
Currency 抽象）は本 issue のスコープから切り出した。

## スコープ境界（重要）

- **本リファクタに含む**: `Money` と `Currency` の shared 昇格、両テストの移設、被参照 33 件の
  import パス更新。
- **本リファクタに含まない（別 issue へ切り出し）**:
  - JSDoc から estimate 固有スペック参照（§8.1・掛率・税率・DB スキーマ言及）を整理する → **#438**。
  - `Currency` が JPY 専用の投機的多通貨抽象である点の見直し → 別 issue 候補（未起票）。
- **挙動・公開シグネチャは不変**。コメントも逐語移動（git 上で純粋なリネームとして見える状態を保つ）。

## 設計判断（grill で確定）

| # | 論点 | 決定 | 根拠 |
|---|---|---|---|
| ① | Currency の扱い | Money と兄弟ファイルで shared へ**同時移動** | Money→Currency 実依存。Money だけ移すと `shared → subdomain` の依存逆転。Currency の外部直接利用者はゼロ |
| ② | import 更新方針 | `@server/shared/domain/values/Money` へ統一 | 既存 shared VO（CompanyCode 等）の慣習。相対5パターン＋`@subdomains/...`1パターンを末尾 `…/Money"` で正規化置換し、tsc で検証 |
| ③ | テスト配置 | `shared/domain/values/__tests__/` 配下 | shared の多数派（Address 等9件）に従う。移動元も `__tests__/` 配下で同形。`MailAddress.test.ts` の co-locate は例外として踏襲しない |
| ④ | バレル影響 | 非該当 | `values/` に index.ts は不在。全 import が直パス・エイリアスのため公開バレルパス変更なし |
| ⑤ | PR/コミット | **単一 PR・単一の原子的コミット** | 移動と import 更新を分けると中間状態が tsc を通らず、Money/Currency も同時移動必須。緑を保てる中間点が無いため「移動＋追従」で1つの意味単位。#426 の先行前提ゆえ最小・単独で速くマージ |
| — | ESLint 境界 | 無改修 | `no-restricted-imports` は Estimate 集約**子エンティティ**限定。値 VO（Money/Currency）には不適用、shared import を禁じる規則も無し |
| — | CONTEXT.md | 変更不要 | Money/Currency は実装パターン VO であり、ユビキタス言語のグロッサリ用語ではない |
| — | ADR | 不要 | 「汎用 VO は shared/domain/values」は既存慣習の適用。可逆・非驚き・トレードオフ不在の3点で ADR 要件を満たさない |

## ステップ（単一コミット）

> 中間状態でビルドが壊れるため、以下を**1コミット**にまとめてから tsc/lint/test を緑にする。

### Step 1: ファイル移設（git mv で履歴保存）
- `src/server/subdomains/estimate/domain/values/Money.ts`
  → `src/server/shared/domain/values/Money.ts`
- `src/server/subdomains/estimate/domain/values/Currency.ts`
  → `src/server/shared/domain/values/Currency.ts`
- `…/values/__tests__/Money.test.ts` → `src/server/shared/domain/values/__tests__/Money.test.ts`
- `…/values/__tests__/Currency.test.ts` → `src/server/shared/domain/values/__tests__/Currency.test.ts`
- 移動後も相対関係が保存されるため**書き換え不要**:
  - `Money.ts` 内の `import { Currency } from "./Currency"`（同一ディレクトリへ同時移動）
  - 各テストの `../Money` / `../Currency`（テストは `__tests__/`、本体は親へ同時移動）

### Step 2: 被参照の import パス更新（33 件）
- Money を import する 33 ファイルの指定子を `@server/shared/domain/values/Money` に統一。
  - 既存表記: `../../values/Money`(12) / `../values/Money`(10) / `@subdomains/estimate/domain/values/Money`(7) /
    `../Money`(2) / `../../../values/Money`(1) / `./Money`(1)。
  - 末尾 `…/Money"`（または `/values/Money"`）で正規化置換。誤爆防止のため置換後に tsc で全解決を確認。
- Currency を外部から直接 import する非 Money ファイルは存在しないため、追加更新は無し
  （`../Currency` は Currency.test のみで Step 1 で解決済み）。

### Step 3: 検証
- `pnpm lint`（ESLint 境界・naming）
- `pnpm test`（移設したテスト＋ estimate 全スイートで挙動不変を確認）
- 型: tsc がエラーなしで通ること（import 取りこぼしゼロの担保）。

### コミットメッセージ（案）
```
refactor: Money/Currency 値オブジェクトを estimate から shared/domain/values へ昇格

Money は estimate 固有でなく金額を扱う任意の文脈で再利用しうる汎用 VO のため、
既存の汎用 VO（Address/CompanyCode 等）と同じ shared 層へ移す。Currency は Money の
実依存先で外部直接利用者が無いため、依存逆転を避けるべく同時移動する。挙動・公開
シグネチャ・JSDoc は不変（差分は import パスのみ）。

#426 pricing の SellingUnitPrice が shared Money に依存するための先行前提。
JSDoc の estimate スペック参照整理は #438 へ切り出し、本 PR の純度（純粋リネーム）を保つ。
```

## 参考
- Issue: #436（本件）、#438（JSDoc 整理・後追い）、#426（後続: pricing が shared Money に依存）
- 既存慣習: `src/server/shared/domain/values/`（Address・CompanyCode・FiscalYear・Prefecture 等の汎用 VO）
- ESLint: `eslint.config.mjs` の `no-restricted-imports`（Estimate 集約子エンティティ限定・本件に不適用）
