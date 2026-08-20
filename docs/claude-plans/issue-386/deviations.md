# 実装計画からの逸脱記録（issue-386）

## クリーンアップ計画（`domain-layer-cleanup.md`）

### D. #15 投機的 `from()` の削除に伴うテスト修正範囲の拡大

- **元の計画**: `ApplicationStatus.test.ts:24-32` と `ApprovalStepStatus.test.ts:24-32`
  （`from()` の正常系/異常系を検証する `describe("from()")` ブロック）のみを削除する。
- **実際の実装**: 上記に加えて、両テストの以下も修正した。
  1. `describe("equals")` 内の「from で取得しても同一インスタンスのため等価」テストが
     `XxxStatus.from("APPROVED").equals(...)` で `from()` に依存していたため、static
     インスタンス直接利用（`XxxStatus.APPROVED.equals(...)`）へ書き換え、テスト名も
     「同一状態は等価」に変更。
  2. `from()` 削除後に未使用となる `ValidationError` の import を両テストファイルから除去。
- **逸脱の理由**: `from()` の参照箇所が計画で想定した `describe("from()")` ブロックだけで
  なく `equals` テストにも存在し、削除すると当該テストがコンパイル不能になるため。import
  の除去は eslint の `no-unused-vars` 違反を避けるため必須。挙動・カバレッジの実質的な
  変更はなく、`from()` への依存を解消するための機械的な追従修正にとどまる。
