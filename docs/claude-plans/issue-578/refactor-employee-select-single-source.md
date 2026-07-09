# Issue #578 追加リファクタ: EmployeeDTO の select を単一真実源化する（TDD）

## Context

`/code-review`（PR #594）で `PrismaEmployeeQueryService` の **select 形状の二重管理**が指摘された（verify: CONFIRMED）。

- `getSelectFields()`（L144-188）が `as const` で「引く列」を定義する一方、`toDTO()` の引数型（L193-208）が **同じ行形状を手書きで再宣言**している。
- 本 PR（役割名列追加）はこの重複を `role.name` / `role.superiorRole.name` / `superiorRole.role.name` の追加ぶん **両所へ手で広げた**。
- リポジトリには `Prisma.*GetPayload<{ include/select: typeof CONST }>` で select 定数から行型を機械導出する規約が9箇所（`EmployeeMapper.ts:14`、`PrismaEstimateQueryService.ts:51,72` ほか）に定着しており、**このファイルだけが手書き型の例外**。

**問題の本質**: select と手書き型が独立に編集できるため、片方だけ変更すると型が実データとズレても `tsc` が検出できない（例: select から `superiorRole.role` を消しても手書き型に残れば、実行時 `undefined.name` でクラッシュするのにコンパイルは通る）。

**ユーザー決定（このPRで対応）**:
- `EMPLOYEE_SELECT` をモジュールレベル定数に切り出し、`satisfies Prisma.EmployeeSelect` を付す。
- `toDTO` の引数型を `Prisma.EmployeeGetPayload<{ select: typeof EMPLOYEE_SELECT }>` の導出型に置換（手書き型を廃止）。
- `getSelectFields()` は「引数なし・状態なし（`this` 不使用）・固定値を返すだけ」の無意味な中間層になるため **削除**し、呼び出し3箇所を定数直参照に置換する（規約の手本 `PrismaEstimateQueryService` もラッパーメソッドを持たず定数を直接参照している。構造まで規約に揃える）。

**ゴール**: select を単一の真実源にし、以後の列追加が1箇所の編集で型まで追従する状態にする。ランタイム挙動は不変。

## 設計判断

### 配置: `EMPLOYEE_SELECT` はモジュールスコープ定数
- 手本の `ESTIMATE_SUMMARY_INCLUDE`（`PrismaEstimateQueryService.ts:61`）と同じく、クラス外のモジュールスコープに `satisfies Prisma.EmployeeSelect` 付きで定義する。
- 理由: `GetPayload<{ select: typeof CONST }>` は `typeof` で定数の型を取るため、定数がモジュールスコープにあると型導出が素直（private メソッド戻り値の `ReturnType` 経由より読みやすく、規約と一致）。

### `getSelectFields()` は削除する（中間層の除去）
- 現状の `getSelectFields()` は引数なし・`this` 不使用・分岐なしで固定 `select` を返すだけ。定数のエイリアス以上の意味を持たず、呼び出しごとにリテラルを再生成するぶん僅かに無駄。
- 呼び出しは `findById`(L21) / `findByEmployeeCd`(L30) / `search`(L42) の3箇所のみ。すべて `select: this.getSelectFields()` → `select: EMPLOYEE_SELECT` に置換して削除する。
- 理由: 手本の QueryService もラッパーメソッドを持たない。中間層を残すと「定数 vs メソッド」の二重の入口ができ、規約から外れる。

### `findSuperiorRoleId` は対象外（非スコープ）
- `findSuperiorRoleId`(L51-82) は承認起点導出のため **独自の select**（`role.superiorRoleId` と `superiorRole.roleId` のみ）を持ち、`getSelectFields()` を使っていない。役割・データ形状が異なる別読み（ADR-20260707-k4e）で、本リファクタの対象外。触らない。

### DTO 形状・挙動は不変
- `EmployeeDTO`（application 層）は変更しない。変えるのは infrastructure 層の型の**導出方法**だけで、`toDTO` が返す値・各フィールドの意味は不変。

## TDD 方針（red-green-refactor の解釈）

純粋な型リファクタ（挙動不変）のため、「失敗するランタイムテストを新規作成」は不自然。代わりに **既存の統合テストを回帰安全網として固定**し、**このリファクタが塞ぐ"型安全の穴"を `tsc` で可視化**する形で red-green-refactor を回す。

### RED（安全網の確認 ＋ 現状の穴の可視化）
1. **回帰安全網の緑を先に確認**: 変更前に下記4テストが緑であることを実行して確認（ベースライン固定）。
   - `PrismaEmployeeQueryService.roleNames.test.ts`（担当役割あり／明示上位課員／上位なし役割持ち／両方なし／search経路 の5 it）
   - `PrismaEmployeeQueryService.assignedRoleId.test.ts`
   - `PrismaEmployeeQueryService.explicitSuperiorRoleId.test.ts`
   - `PrismaEmployeeQueryService.findSuperiorRoleId.test.ts`
2. **型安全の穴を RED として可視化**（一時的・コミットしない）: 現状の `toDTO` 手書き型 or `getSelectFields` の select を **わざと片方だけ1フィールドズラす**（例: select から `superiorRole.role.name` を消す／手書き型に余分なフィールドを足す）。`pnpm tsc --noEmit` が **通ってしまう**ことを確認する（＝現状は型が守っていない ＝ これが直したい欠陥＝RED）。確認後、ズラしを元に戻す。

### GREEN（リファクタ実装）
3. `EMPLOYEE_SELECT` をモジュール定数化（`satisfies Prisma.EmployeeSelect`）。
4. `type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof EMPLOYEE_SELECT }>` を定義し、`toDTO(employee: EmployeeRow)` に置換（手書き型を削除）。
5. `getSelectFields()` を削除し、3箇所の `select: this.getSelectFields()` を `select: EMPLOYEE_SELECT` に置換。
6. **回帰安全網が緑のまま**であることを再確認（`pnpm test`）＝挙動不変の担保。
7. **穴が塞がったことを確認（GREEN）**: 手順2と同じズラしを再度入れると、今度は `pnpm tsc --noEmit` が **落ちる**ことを確認（＝ select と行型が単一真実源で連動）。確認後ズラしを戻す。

### REFACTOR
8. コメント整理（`getSelectFields` の JSDoc を `EMPLOYEE_SELECT` へ移設・簡潔化）、`pnpm lint`。挙動・型に影響しない仕上げのみ。

## ステップ / コミット計画

意味のあるまとまりでコミットする（一括コミットしない）。

- **Step 0（この計画）**: `docs:` — 本計画ファイル。
- **Step 1（GREEN本体）**: `refactor:` — `EMPLOYEE_SELECT` 定数化＋`GetPayload` 導出型で `toDTO` 置換＋`getSelectFields` 削除＋呼び出し3箇所置換。
  - コミットボディに設計判断を記載: 「select 定数をモジュールスコープに配置し `getSelectFields` メソッドを削除。理由: select を単一真実源化し、手本の `PrismaEstimateQueryService`（定数直参照・ラッパーメソッドなし）と構造を揃えるため。手書き行型は `GetPayload` 導出に置換し二重管理を解消」。
- **Step 2（任意・REFACTOR）**: 同 `refactor:` に含めてよい（コメント整理が軽微なら Step 1 に同梱）。

## 検証

- `pnpm test`: 上記4テストが緑（挙動不変の回帰確認）。schema 変更なしのため `pnpm test:setup` 不要。
- `pnpm tsc --noEmit`（or `pnpm build` の型チェック）: 導出型で全体が型整合。RED/GREEN の穴確認もこれで行う。
- `pnpm lint`: 定数移設後のスタイル整合。
- E2E は不要（表示挙動・DTO 形状は不変。既存 `employees-list.e2e.ts` の緑は CI に委ねる）。

## リスク / 非対象

- **リスク（低）**: `GetPayload<{ select: typeof CONST }>` の導出型が現行手書き型と厳密一致するか。`satisfies` と `as const` の相性で `select` のネストが正しく型に反映されるかは実装時に `tsc` で即検証（不一致ならその場で判明）。
- **非対象**: `findSuperiorRoleId` の独自 select、`EmployeeDTO`（application 層）、他 QueryService。本リファクタは `PrismaEmployeeQueryService` 内に閉じる。
- **deviations**: 実装中に本計画と異なる対応をした場合、`docs/claude-plans/issue-578/deviations.md` に {元計画/実際/理由} を記録する（CLAUDE.md ルール）。
