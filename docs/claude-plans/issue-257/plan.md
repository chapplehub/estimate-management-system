# Issue #257 実装計画

## 背景

`roles-crud.e2e.ts` が create-e2e-test スキル §11（簡易 chain）・§13（failure-only シード分離）に準拠していない。

## 仕様確認結果

一般ユーザーは `/roles/new` へアクセス不可（`roles-crud.e2e.ts:218-223` で既にテストされている）→ **権限差異がある機能**。

SKILL §11「権限差異がある機能のみ両ユーザーでテスト」「権限差異なし → 管理者テストのみ + 一般ユーザー簡易 chain 1 つ」に照らすと、今回は**権限差異あり**なので一般ユーザー簡易 chain は省略する（Issue 本文「仕様上必要な場合」の対応にも合致）。

## 実装ステップ

### Step 1: `prisma/seed-e2e.ts` に ROLE9NN 帯シードを追加

追加するデータ:

| cd | name | positionCd | superiorCd | 用途 |
|---|---|---|---|---|
| `ROLE901` | `E2E専用_下位役割あり削除テスト親役割` | POS004（社長） | null | 下位役割を持つ親 |
| `ROLE902` | `E2E専用_下位役割あり削除テスト子役割` | POS003（本部長） | ROLE901 | ROLE901 の下位 |
| `ROLE903` | `E2E専用_使用中削除テスト役割` | POS001（課長） | ROLE003 | E2E専用従業員に割り当てる |

加えて、`ROLE903` を「使用中」にするための E2E 専用従業員を 1 名追加:

- `EMP999001`（E2E専用_使用中テスト従業員, DEPT001）に `ROLE903` を割り当て

実装方針:
- `ROLES` 配列に ROLE901-903 を追加（`superiorCd` の順序依存があるため配列末尾に追加）
- 新規配列 `E2E_ONLY_ROLE_EMPLOYEES` を導入し、メイン処理で独立ブロックとして E2E 専用従業員を作成 → `employeeRole` を作成
- コメントで §13 の「`E2E専用_` プレフィックス」「シナリオ明示」ルールを満たす

### Step 2: `roles-crud.e2e.ts` のドメインエラーテストを ROLE9NN 参照へ変更

- SKILL §5 に倣い、定数化して意味を明示
  ```ts
  const ROLE_HAS_CHILDREN = "ROLE901";  // seed-e2e.ts: 下位役割あり削除テスト用
  const ROLE_IN_USE = "ROLE903";        // seed-e2e.ts: 使用中削除テスト用
  ```
- 「使用中の役割は削除できない」: `ROLE005` → `ROLE_IN_USE`（ROLE903）
- 「下位役割がある役割は削除できない」: `ROLE001` → `ROLE_HAS_CHILDREN`（ROLE901）
- コメント（"ROLE005は..."）を実データに合わせて更新

### Step 3: 一般ユーザー簡易 chain

権限差異あり機能のため**省略**（SKILL §11 準拠）。既存の「権限エラーテスト」「閲覧のみ」テストで必要な回帰検知はカバー済み。

### Step 4: 検証

1. `pnpm lint`
2. `pnpm e2e:seed` で新規シード生成確認
3. `pnpm e2e -- --grep "使用中|下位役割"` で該当テストのみ実行
4. フル `pnpm e2e` で回帰チェック

## 完了条件

- [x] ドメインエラーテストが `ROLE9NN` 帯の E2E 専用シードを参照
- [x] `seed-e2e.ts` の `ROLE9NN` シードに `E2E専用_` プレフィックス付き
- [x] 一般ユーザー簡易 chain は権限差異あり機能のため省略（§11 準拠）
- [x] `pnpm e2e` が成功
