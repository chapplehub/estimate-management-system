# Prisma ID生成の仕組み

## 現在の方式: UUIDv7（ドメイン層で生成）

このプロジェクトでは、ID生成にUUIDv7を使用している。
Prismaの `@default(cuid())` や `@default(uuid())` は使わず、ドメイン層の `generateId()` 関数で生成したIDをPrismaに渡す方式を採用。

### UUIDv7とは？

UUIDv7はRFC 9562で標準化されたID形式。

| 特徴 | 説明 |
|------|------|
| 形式 | `0192d38a-e5b7-7c80-9e1a-...`（36文字） |
| ソート可能 | 先頭48ビットがミリ秒タイムスタンプ → 生成順 = 辞書順 |
| 標準規格 | RFC 9562準拠 |
| 安全性 | 分散システムでも衝突しない |
| DB互換性 | PostgreSQLのネイティブUUID型と互換 |

### UUIDv7の構造

```
0192d38a-e5b7-7c80-9e1a-4b5c6d7e8f9a
├─────────────┘ │  │     └─ ランダムビット
│              │  └─ バリアント (10xx)
│              └─ バージョン (7)
└─ ミリ秒タイムスタンプ (48ビット)
```

## ID生成の仕組み

### 生成場所: ドメイン層（アプリケーション側）

```typescript
// src/server/shared/generateId.ts
import { v7 as uuidv7 } from "uuid";

export function generateId(): string {
  return uuidv7();
}
```

### エンティティでの使用パターン

```typescript
// Entity.create() でIDを生成
import { generateId } from "@server/shared/generateId";

export class Employee {
  static create(employeeCd: EmployeeCd, ...): Employee {
    return new Employee(
      generateId(), // UUIDv7を生成
      employeeCd,
      ...
    );
  }

  // DBからの復元時はIDを受け取る（生成しない）
  static reconstruct(id: string, ...): Employee {
    return new Employee(id, ...);
  }
}
```

### Prismaスキーマでの定義

```prisma
model Employee {
  id  String  @id  // ドメイン層でUUIDv7生成（DEFAULT句なし）
  // ...
}
```

DBのテーブル定義には `DEFAULT` 句がない。アプリケーション側で生成したIDをINSERT文に含めて送信する。

### better-authテーブル

認証関連テーブル（User/Session/Account/Verification）も `better-auth` の `advanced.database.generateId` コールバックで同じ `generateId()` を使用し、プロジェクト全体でUUIDv7に統一している。

## ID生成方法の比較

| 方式 | 生成場所 | ソート | 長さ | 特徴 |
|------|---------|--------|------|------|
| **UUIDv7（採用）** | アプリ側 | 時系列順 | 36文字 | RFC標準、タイムスタンプ内蔵 |
| UUIDv4 | アプリ側 | 不可 | 36文字 | 完全ランダム |
| CUID2（旧方式） | アプリ側 | 不可 | 25文字 | 独自フォーマット |
| autoincrement | DB側 | 連番順 | 可変 | 予測可能（セキュリティ注意） |

## なぜUUIDv7を使うのか？

### CUID2からの移行理由

1. **ソート不可**: CUID2はセキュリティのためタイムスタンプベースのソートを排除
2. **DB互換性**: CUIDは独自フォーマットでPostgreSQLネイティブUUID型と互換性なし
3. **標準規格**: UUIDv7はRFC 9562で標準化されており、エコシステムのサポートが広い

### UUIDv7のメリット

- B-treeインデックスへの挿入がシーケンシャルになり、断片化を軽減
- 辞書順ソート = 時間順ソートが成立
- `generateId()` に集約されており、将来の変更が1箇所で完結

## 参考リンク

- [RFC 9562 - UUIDs](https://www.rfc-editor.org/rfc/rfc9562)
- [uuid npm package](https://www.npmjs.com/package/uuid)
- [ADR-0009: ID生成方式をCUID2からUUIDv7に移行する](../docs/adr/0009-migrate-id-generation-from-cuid2-to-uuidv7.md)
