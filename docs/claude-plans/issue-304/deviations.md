# Issue #304 実装計画からの逸脱記録

## 1. ドメインサービステストの save → insert 移行（対象ファイルの追加）

- **元の計画内容**: テスト変更対象は `PrismaEmployeeRepository.test.ts` / `UpdateEmployeeCommand.test.ts`（および Create 側）/ `EmployeeUpdateForm.test.tsx` の3系統。
- **実際の実装内容**: 上記に加え `EmployeeCdDuplicationCheckDomainService.test.ts` と `MailAddressDuplicationCheckDomainService.test.ts` のフィクスチャ作成箇所を `repository.save` から `repository.insert` へ移行した。
- **逸脱の理由**: 両テストがフィクスチャ作成に `save` を使っており、`save` 廃止（受け入れ条件）に伴う型エラーで発覚した随伴修正。計画時の `save` 呼び出し元調査がプロダクションコードのみを対象にしており、テストコードの利用箇所を見落としていた。

## 2. expectedVersion 素通し検証の方式（モック検証 → 振る舞い検証）

- **元の計画内容**: 「コマンド単体テストで expectedVersion の素通しを検証」（Issue 本文・ADR-0039 の文言を踏襲）。
- **実際の実装内容**: モックリポジトリへの引数検証ではなく、既存テストスイートのスタイル（実 DB + FakeUserManagementService の統合スタイル）に合わせ、「stale な expectedVersion で実行すると ConflictError になり、employee 行と認証ユーザーが変更されない」という観測可能な振る舞いで素通しを検証した。
- **逸脱の理由**: 既存の `UpdateEmployeeCommand.test.ts` が実 DB 統合スタイルで統一されており、モック検証を持ち込むと実装詳細（リポジトリ呼び出しのシグネチャ）に結合したテストになる。振る舞い検証なら素通しの正しさ（誤った値や再取得値を渡せばテストが落ちる）を同等以上に保証しつつ、Q1 で決めた「ConflictError 時に User 同期へ到達しない」順序固定の検証と1テストに自然に統合できるため。
