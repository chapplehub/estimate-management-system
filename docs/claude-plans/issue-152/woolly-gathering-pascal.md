# Issue #152: seed.tsをauth.setup.tsと整合性が取れるように修正する

## Context

Playwright の `auth.setup.ts` では以下の前提でE2Eテストの認証情報を作成している:
- `employee1@example.com` → 管理者 (ADMIN)
- `employee2@example.com` → 一般ユーザ (USER)

しかし `prisma/seed.ts` の `determineRole` 関数は index=1 のみ ADMIN を保証し、index=2 以降は `Math.random() < 0.05` で約5%の確率で ADMIN になる。そのため `employee2@example.com` が ADMIN になり得る不整合がある。

## 修正内容

### Step 1: `determineRole` 関数の修正

**ファイル**: `prisma/seed.ts` (L723-728)

現在:
```typescript
function determineRole(index: number): UserRole {
  if (index === 1) return USER_ROLES.ADMIN;
  return Math.random() < ADMIN_RATIO ? USER_ROLES.ADMIN : USER_ROLES.USER;
}
```

修正後:
```typescript
function determineRole(index: number): UserRole {
  // 最初の1人は必ず管理者
  if (index === 1) return USER_ROLES.ADMIN;
  // 2人目は必ず一般ユーザ（auth.setup.tsのE2Eテストと整合性を保つため）
  if (index === 2) return USER_ROLES.USER;
  // それ以降は確率で決定
  return Math.random() < ADMIN_RATIO ? USER_ROLES.ADMIN : USER_ROLES.USER;
}
```

index=2 を必ず USER にする1行 + コメントで理由を明記。

## 修正対象ファイル

- `prisma/seed.ts` — `determineRole` 関数 (L723-728)

## 検証方法

1. `pnpm db:migrate` でDBリセット後、seed を実行し employee2 が USER ロールであることを確認
2. E2Eテスト (`auth.setup.ts`) が正常に通ることを確認
