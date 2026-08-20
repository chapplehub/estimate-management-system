# Issue #483: 共通売単価 保守画面の表示語を正準語「共通販売単価」へ統一

## Context

`CONTEXT.md`「価格」節の正準語は **「共通販売単価 (Common Selling Price)」**（`CONTEXT.md:101`、_Avoid_: 定価／標準単価）。しかし共通売単価 保守画面の H1 等は未記録の短縮形「共通売単価」になっており、ユビキタス言語がコードからドリフトしている。

特に**画面間で既に不整合**が発生している：ダッシュボード導線ラベルは正準語「共通販売単価」だが、遷移先 H1 は「共通売単価」。`dashboard.e2e.ts:26` がその誤った H1 をアサートしており、矛盾がテストに固定化されている。

#481（E2E テスト作成）が UI 表示語をアサートするため、**E2E を書く前に表示語を正準語へ確定**する必要がある（#482 も同様に #481 前の画面修正）。

機能挙動は不変で、表示語と関連コメントの語彙のみを変更する純粋なリファクタリング。

## スコープ（ユーザー確認済み）

- **画面表示テキスト**（4ファイル・計8箇所）+ `dashboard.e2e.ts`（1箇所）
- **app層の JSDoc/コメント**（同一機能配下の非ユーザー向けコメント）も今回まとめて正準語へ統一
- **対象外**: サーバ層（`src/server/...`）の JSDoc/コメント、英語識別子・ファイルパス・ルートセグメント `common-selling-prices`

## 変更内容

すべて `共通売単価` → `共通販売単価` の置換（前後の語との連結含む。例: `共通売単価一覧` → `共通販売単価一覧`、`共通売単価（円）` → `共通販売単価（円）`）。

### ステップ1: 画面表示テキストの統一（1コミット）

| ファイル | 箇所 |
|---------|------|
| `src/app/(features)/common-selling-prices/page.tsx` | `:52` H1「共通売単価」/ `:61` h2「共通売単価一覧」 |
| `src/app/(features)/common-selling-prices/[productCd]/page.tsx` | `:34` 戻りリンク「← 共通売単価一覧に戻る」/ `:39` H1「共通売単価」 |
| `src/app/(features)/common-selling-prices/[productCd]/PeriodDetailPanel.tsx` | `:81` 列見出し「共通売単価」/ `:159` 空メッセージ「…共通売単価が無いと…」 |
| `src/app/(features)/common-selling-prices/[productCd]/PeriodForm.tsx` | `:144` 項目名「共通売単価」/ `:198` ラベル「共通売単価（円）」 |

### ステップ2: E2E アサーションの追従（1コミット）

| ファイル | 箇所 |
|---------|------|
| `src/app/(features)/dashboard/dashboard.e2e.ts` | `:26` H1 アサーション `name: "共通売単価"` → `"共通販売単価"` |

ステップ1（画面変更）とステップ2（テスト追従）は密結合だが、CLAUDE.md の「意味のあるまとまりでコミット」方針に従い、画面語彙の確定とテスト追従を分けて2コミットとする。

### ステップ3: app層コメントの語彙統一（1コミット）

| ファイル | 箇所 |
|---------|------|
| `src/app/(features)/common-selling-prices/[productCd]/actions.ts` | `:20` JSDoc |
| `src/app/(features)/common-selling-prices/[productCd]/schema.ts` | `:4` / `:23` JSDoc |
| `src/app/(features)/common-selling-prices/_data/period-rules.ts` | `:2` JSDoc |

## 検証

- `grep -rn "共通売単価" src/app/` → ヒット0件（app配下に短縮形が残っていないこと）
- `grep -rn "共通売単価" src/server/` → サーバ層コメントは意図的に残置（対象外）
- `pnpm lint` が green
- E2E: `pnpm e2e` でダッシュボードの導線ラベルと遷移先 H1 が一致し、`dashboard.e2e.ts` の H1 アサーションが更新後の「共通販売単価」で green になること
  - （E2E が重い場合は最低限 `dashboard.e2e.ts` の H1 アサート行が新表示語と一致していることを目視確認）

## 設計判断メモ

- 表示語のみ変更で機能は不変。値オブジェクト名 `SellingUnitPrice` 等の英語識別子・型は CONTEXT.md の英語正準語 (Common Selling Price) に対応済みのため変更しない。
- サーバ層コメントを今回除外するのは Issue の `対象外` 方針に従うため。必要なら別 Issue で追従。
