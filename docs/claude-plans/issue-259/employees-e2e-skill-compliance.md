# Issue #259: test: employees e2e の create-e2e-test スキル準拠（簡易chain追加・命名規則統一） — 実装計画

## Context

`src/app/(features)/employees/employees-crud.e2e.ts` を `create-e2e-test` スキル（`.claude/skills/create-e2e-test/SKILL.md`）に準拠させる。Issue #257（roles） / #258（departments）と同一趣旨のリファクタの第3弾。

違反点と判断（Issue #259 本文より）:

1. **§5 命名規則の可読性**: 現状の `TEST_EMPLOYEE_CD = "EMP099901"` は 9NN 帯のルールにぎりぎり適合するが、先頭 `099` が「0埋めにより偶然生まれた形」に見え、E2E 専用を明示できていない。
2. **§11 一般ユーザー簡易 chain**: `/employees/new` が一般ユーザーで利用可能かを確認し、不可なら省略、可なら追加が必要。

## 仕様確認結果（§11 適用方針）

`src/proxy.ts:6` の `adminRoutes = ["/employees/new", "/departments/new", "/roles/new"]` により `/employees/new` は admin 専用。一般ユーザーは `/signin?reason=forbidden` へリダイレクトされる（既存テスト `employees-crud.e2e.ts:138-143` でも確認済み）。

SKILL §11「権限差異がある機能のみ両ユーザーでテスト」「権限差異なし → 管理者テストのみ + 一般ユーザー簡易 chain 1 つ」に照らすと、本機能は**権限差異あり**に該当するため、**一般ユーザー簡易 chain は省略**する（Issue #257 roles / #258 departments と同判断）。

現状の一般ユーザー向けテスト（`/employees/new` forbidden / owner 編集 / 他人の閲覧）は SKILL §11「権限エラーテスト（必須）」を満たしている。

## 設計判断

### §5 テストデータコード

既存 E2E 専用従業員 `EMP999001`（`seed-e2e.ts:103` の `E2E_ONLY_EMPLOYEES`）が `EMP999xxx` 名前空間を使っているため、成功系CRUD用も同名前空間の `EMP999901` に統一する。

- A. 現状維持（`EMP099901`）
- B. `EMP900001` 等（Issue 本文の提案）
- **推奨: C. `EMP999901`**（既存 E2E 専用 `EMP999001` と名前空間を共有し、`xxx9NN` 帯慣習にも整合）

### §11 簡易 chain

省略を選択（上記「仕様確認結果」参照）。テストファイル冒頭コメントに省略根拠を明記して準拠の証跡を残す。

### §13 ドメインエラー用シード分離

employees には「削除可否がドメイン状態に依存するエラー」が現状無い。既存の「重複する従業員コード」テストは SKILL §3 分類で**簡易エラー**（DB 不変・共通シードで可）のため、`seed-e2e.ts` への追加は不要。

## ステップ

### Step 1: `employees-crud.e2e.ts` のテストデータコード統一と§11根拠コメント追加
- 対象ファイル: `src/app/(features)/employees/employees-crud.e2e.ts`
- 作業内容:
  - `TEST_EMPLOYEE_CD = "EMP099901"` → `TEST_EMPLOYEE_CD = "EMP999901"` へ変更
  - 定数コメントを「seed範囲外」から「seed-e2e.ts の E2E 専用名前空間 EMP999xxx に属する成功系CRUD用コード」に刷新
  - 一般ユーザーブロック冒頭に「§11 簡易 chain 省略根拠（権限差異あり機能のため）」をコメントで明記
- コミットメッセージ: `test: employees-crud のテストデータコードを EMP999 帯に統一し §11 省略根拠を明記`
- コミットボディに記載する設計判断:
  - 既存 E2E 専用 EMP999001 と名前空間を共有することで E2E 専用であることを明示（SKILL §5）
  - 簡易 chain 省略は `/employees/new` が admin 専用であるため（Issue #257/#258 と同判断）

### Step 2: 検証
- `pnpm lint`
- `pnpm e2e:seed`（念のためリシード）
- `pnpm e2e -- --grep "従業員"` で該当テストのみ実行し全パス確認
- 失敗時は修正 → 再コミット

## 完了条件

- [ ] §5 準拠: `TEST_EMPLOYEE_CD` が E2E 専用名前空間（`EMP999xxx`）に属している
- [ ] §11 準拠: 権限差異あり機能のため簡易 chain を省略している旨がコード内で明確
- [ ] `pnpm lint` 成功
- [ ] `pnpm e2e -- --grep "従業員"` 全パス

## 参照

- `.claude/skills/create-e2e-test/SKILL.md` §5, §11, §13
- `docs/claude-plans/issue-257/plan.md`（roles の同趣旨計画）
- `docs/claude-plans/issue-258/plan.md`（departments の同趣旨計画）
- 実装参考コミット: `187db7c`（roles） / `4d4e70b`（departments）
