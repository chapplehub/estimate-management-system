# Prisma スキーマから FK 親子関係とカスケード削除の読み方

作成日: 2026-02-20

## 概要

Prisma スキーマの `@relation` ディレクティブから FK の親子関係と削除時の挙動を読み取る方法。テストのクリーンアップで削除順序を間違えないために必要な知識。

## 詳細

### @relation の読み方

```prisma
// Customer → Company: 親が消えたら子も消える
company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

// DeliveryLocation → Customer: onDelete 指定なし = Restrict（デフォルト）
customer Customer @relation(fields: [customerId], references: [id])
```

| onDelete | 意味 |
|---|---|
| `Cascade` | 親レコード削除時に子も自動削除される |
| 指定なし（デフォルト） | `Restrict` = 参照する子がある限り親は削除不可 |

### 本プロジェクトの具体例

```
Company (code: "CUST999811") ←[Cascade]── Customer ←[Restrict]── DeliveryLocation
Company (code: "DL999801")   ←[Cascade]── DeliveryLocation
```

- Company 削除 → Customer/DeliveryLocation はカスケードで消える
- Customer 削除 → DeliveryLocation が参照していると **FK 制約違反でエラー**

### テストクリーンアップの正しい順序

```typescript
// 1. DL の Company を先に削除（カスケードで DL も消える → Customer への参照が解消）
await prisma.company.deleteMany({
  where: { code: { in: DL_TEST_CODES } },
});

// 2. Customer の Company を削除（カスケードで Customer も消える）
await prisma.company.deleteMany({
  where: { code: CUSTOMER_TEST_CODE },
});
```

順序を逆にすると、DL がまだ Customer を参照しているため FK 制約違反になる。

## 参考

- `prisma/schema.prisma` (Company, Customer, DeliveryLocation モデル定義)
- `src/server/subdomains/delivery-location/domain/services/__tests__/DeliveryLocationCodeDuplicationCheckDomainService.test.ts`
