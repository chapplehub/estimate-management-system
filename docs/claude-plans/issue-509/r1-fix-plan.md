# auto-review-fix ラウンド1 修正計画（PR #541 / /code-review medium）

judge 評価で採用された指摘（採用①: 1件、採用③: 1件）の修正計画。
判定の全文は PR #541 の「⚖️ judge 評価 ラウンド 1」コメントを参照。

## 修正1: seed コメントの偽の隔離主張を訂正（バケツ① / severity参考: Low）

- **file:line**: `prisma/seed-e2e.ts:650-652`（PRD867〜869 直前のコメント）
- **問題**: 「商品名は『得意先単価CRUD_』前置で C902 帯（得意先単価_）と区別し、名前検索の相互干渉を避ける」
  は偽。一覧 E2E は `?name=得意先単価` の部分一致（ILIKE `%得意先単価%`）で検索するため、
  `得意先単価CRUD_...` も検索結果にヒットする（前方一致部分文字列）。現状は一覧の assertion が
  すべて行スコープのため実害はないが、偽の不変条件を文書化しており、これを信じた将来の
  件数 assertion 追加が flake を誘発する。
- **修正方針**: 隣接する PRD866 コメント（637-639行）が既に採っている正直な書き方に揃える。
  「名前検索にヒットするが、一覧の assertion は行スコープのみで件数を見ないため干渉しない」
  という真の理由へ書き換える。**商品名・コードなどシードデータ本体は一切変更しない**
  （名前変更は list/crud スペックのセレクタに波及するため）。
- **影響範囲**: コメント1箇所のみ。挙動不変。
- **想定テスト**: `pnpm lint` / `pnpm test`（コメントのみのため既存テストが緑のまま通ることを確認）。

## 修正2: E2E 2ファイルを機能ルート直下へ移動（バケツ③ / severity参考: Medium）

- **file:line**:
  - `src/app/(features)/customer-selling-prices/[customerCd]/[productCd]/customer-selling-prices-detail.e2e.ts`
  - `src/app/(features)/customer-selling-prices/[customerCd]/[productCd]/customer-selling-prices-crud.e2e.ts`
- **問題**: 計画書 Step 2/4 は `customer-selling-prices/` 機能ルート直下を指定し、既存の全 E2E スペック
  （common-selling-prices / cost-prices / delivery-locations 等 36本）も機能ルート直下にあるが、
  この 2 本だけ動的ルート `[customerCd]/[productCd]/` 配下に作成されていた。CLAUDE.md が要求する
  deviations.md も未作成（＝無自覚の逸脱）。
- **修正方針**: `git mv` で 2 ファイルを `src/app/(features)/customer-selling-prices/` 直下へ移動する。
  deviations.md による逸脱正当化ではなく「移動」を選ぶ理由: 動的ルート配下に置く設計上の利点が皆無で、
  計画と全兄弟スペックの慣習が全会一致で置き場所を一意に定めるため（③の「設計判断不要」を満たす）。
- **③採用根拠**: 挙動不変（playwright `testMatch: **/*.e2e.ts` はどちらの配置でも検出、import は
  `@playwright/test` のみで相対パス依存なし）・設計判断不要（置き場所が一意）・局所的（2ファイルの
  移動のみ、公開シグネチャ変更なし）。
- **影響範囲**: ファイルパスのみ。テスト内容・実行対象は不変。
- **想定テスト**: `pnpm lint` / `pnpm test`。E2E 全体はローカルで回さず CI に委ねる（プロジェクト方針）。

## 修正しない指摘（④残課題・却下）

- serial チェーンの CI リトライ非冪等（crud:45）と重複拒否テストの DB 不変 assert 欠落（crud:231）は、
  ミラー元 common-selling-prices 側も同一構造のため、両ミラー一括のフォローアップ Issue で扱う。
- 404 センチネル C999（detail:128）は計画準拠（計画 Step 2 が C999×PRD860 を明示）のため現状維持。
- registerPeriod ヘルパー抽出（crud:52）はミラー同型性を崩すため見送り（③基準未達: 設計判断あり）。
- jstRelativeDate(0) の JST 日跨ぎ（crud:130）は ADR-0020 公認規約に準拠のため却下。
- 非リトライ型 thead assertion（crud:268）は実害なしのため却下。
