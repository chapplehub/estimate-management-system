# Issue #258 実装計画

## 背景

`src/app/(features)/departments/departments-crud.e2e.ts` が create-e2e-test スキル（`.claude/skills/create-e2e-test/SKILL.md`）に準拠していない。Issue #257（roles）の対応と同様の構造的リファクタを実施する。

違反箇所（Issue #258 本文より）:
1. **§4 chain 粒度違反**: ライフサイクル chain 内に `isActive` ステータス変更が混在
2. **§13 ドメインエラーの自前構築**: 子部署削除制約テストが serial 内で PARENT/CHILD を自前 create → delete
3. **§11 簡易 chain の欠如確認**: 閲覧テストのみで簡易 chain がない

## 仕様確認結果

既存テスト（`departments-crud.e2e.ts:212-217`）で `一般ユーザーは /departments/new にアクセスできない（/signin?reason=forbidden にリダイレクト）` が確認されている → **権限差異あり機能**。

SKILL §11「権限差異がある機能のみ両ユーザーでテスト」「権限差異なし → 管理者テストのみ + 一般ユーザー簡易 chain 1 つ」に照らすと、今回は**権限差異あり**なので**一般ユーザー簡易 chain は省略**する（Issue #257 roles と同判断）。

## テストデータコード設計

| cd | 区分 | 用途 |
|---|---|---|
| `DEPT901` | 共通シード（`seed-e2e.ts`） | E2E専用_子部署あり削除テスト親部署 |
| `DEPT902` | 共通シード（`seed-e2e.ts`） | E2E専用_子部署あり削除テスト子部署（親=DEPT901） |
| `DEPT903` | テスト内生成（ライフサイクル chain） | 作成 → 更新 → 削除 |
| `DEPT904` | テスト内生成（ステータス chain） | 作成 → 無効化 → 有効化 → 削除 |

**DEPT901 は従来テスト内での `TEST_DEPT_CD` 値だったが、シード予約のため番号を下げる**（Issue #257 の ROLE901 → ROLE904 と同じ判断）。

## 実装ステップ

### Step 1: `prisma/seed-e2e.ts` に `E2E_ONLY_DEPARTMENTS` を追加

追加するデータ:

| cd | name | abbreviation | parentDepartmentCd |
|---|---|---|---|
| `DEPT901` | `E2E専用_子部署あり削除テスト親部署` | `E2E親` | null |
| `DEPT902` | `E2E専用_子部署あり削除テスト子部署` | `E2E子` | `DEPT901` |

実装方針:
- `DEPARTMENTS` 配列とは分離（`E2E_ONLY_DEPARTMENTS`）。理由: §13 の共通/E2E 専用境界を明確化
- `name` に `E2E専用_` プレフィックス（§13 準拠）
- 親子関係は既存 department スキーマの `parentDepartmentId` を使う
- メイン処理で部署作成ブロックの後に E2E 専用部署を作成（親→子の順）

### Step 2: `departments-crud.e2e.ts` を分離

1. 定数を整理
   ```ts
   const TEST_DEPT_CD = "DEPT903";           // ライフサイクル chain
   const STATUS_TEST_DEPT_CD = "DEPT904";    // ステータス管理 chain
   const PARENT_WITH_CHILD = "DEPT901";      // seed-e2e.ts: 子部署あり削除テスト親
   ```
2. **ライフサイクル chain**（`test.describe.serial "作成・更新・削除"`）: 作成 → 更新 → 削除（isActive は含めない）
3. **ステータス管理 chain**（`test.describe.serial "ステータス管理"`）: 作成 → 無効化 → 有効化 → 削除（DEPT904）
4. **子部署あり削除不可**: serial 外の単体テストに切り出し、`PARENT_WITH_CHILD` を参照（テスト内 create/delete を排除）
5. 既存の個別テスト（重複エラー / キャンセル / 削除ボタン表示 / 404）はそのまま
6. 一般ユーザー簡易 chain は §11 準拠で省略

### Step 3: 検証

1. `pnpm lint`
2. `pnpm e2e:seed` でシード再生成確認
3. `pnpm e2e -- --grep "部署"` で該当テストのみ実行
4. `pnpm e2e` でフル回帰

## 完了条件

- [ ] §4 準拠: ライフサイクル chain と ステータス管理 chain が独立
- [ ] §13 準拠: 「子部署あり削除不可」が `DEPT901`/`DEPT902` を参照（テスト内 create/delete なし）
- [ ] §11 準拠: 権限差異あり機能のため簡易 chain 省略（方針を明記）
- [ ] `pnpm lint` 成功
- [ ] `pnpm e2e` 成功
