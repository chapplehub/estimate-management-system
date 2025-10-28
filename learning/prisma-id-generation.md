# Prisma ID生成の仕組み

## `@id @default(cuid())` の意味

Prismaのモデル定義で以下のような指定を見かけます：

```prisma
model Employee {
  id  String  @id @default(cuid())
  // ...
}
```

### 各属性の意味

#### 1. `@id`
- このフィールドが**主キー（Primary Key）**であることを示す
- テーブル内でレコードを一意に識別するための識別子
- データベースでは `PRIMARY KEY` 制約として作成される

#### 2. `@default(cuid())`
- レコード作成時に**自動的にデフォルト値を生成**する
- `cuid()` = **CUID (Collision-resistant Unique Identifier)** を生成する関数

## CUIDとは？

**CUID (Collision-resistant Unique Identifier)** の特徴：

| 特徴 | 説明 |
|------|------|
| 形式 | ランダムで衝突しにくい一意な文字列 |
| 例 | `clxyz123abc456def789` |
| 長さ | 約25文字 |
| ソート可能 | タイムスタンプベースで生成順にソート可能 |
| 安全性 | 分散システムでも安全に使える |
| URL適合性 | ハイフンがないのでURLに使いやすい |

## 重要：生成場所はどこ？

**答え：Prisma Client（プログラム側）で生成される**

❌ **誤解しやすい点：**
- DBで自動採番されるわけではない

✅ **正しい理解：**
- Prisma Clientがアプリケーション側で生成してDBに送信する

### 具体的な動作フロー

```typescript
// 1. あなたが書くコード
const employee = await prisma.employee.create({
  data: {
    // id は指定しない！
    employeeCd: "EMP000001",
    email: "test@example.com",
    name: "山田太郎",
  }
});

// 2. Prisma Clientが自動的に行うこと
// ① プログラム側でCUIDを生成: "clxyz123abc456def789"
// ② DBに送信するSQL:
//    INSERT INTO employees (id, employee_cd, email, name, ...)
//    VALUES ('clxyz123abc456def789', 'EMP000001', 'test@example.com', ...)

// 3. 結果
console.log(employee.id); // => "clxyz123abc456def789"
```

### 実際のDBテーブル定義

```sql
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,  -- ← DEFAULT句なし！
    "employee_cd" TEXT NOT NULL,
    ...
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);
```

**ポイント：**
- DBのテーブル定義には `DEFAULT` 句がない
- Prismaが値を生成してINSERT文に含めて送信する

## ID生成方法の比較

| Prisma指定 | 生成場所 | データ型 | 例 | 用途 |
|-----------|---------|---------|-----|------|
| `@default(cuid())` | **Prisma Client** | String | `"clxyz123..."` | 推奨：セキュアで予測不可能 |
| `@default(uuid())` | **Prisma Client** | String | `"550e8400-..."` | UUID標準に準拠したい場合 |
| `@default(autoincrement())` | **PostgreSQL** | Int | `1, 2, 3, ...` | シンプルな連番が欲しい場合 |
| `@default(now())` | **PostgreSQL** | DateTime | `2025-10-28 12:34:56` | タイムスタンプ |

### 詳細比較

```prisma
// 1. CUID（このプロジェクトで採用）
id  String  @id @default(cuid())
// 生成場所：Prisma Client
// 例：      "clxyz123abc456def789"
// 特徴：    短い、予測不可能、ソート可能

// 2. UUID
id  String  @id @default(uuid())
// 生成場所：Prisma Client
// 例：      "550e8400-e29b-41d4-a716-446655440000"
// 特徴：    標準規格、少し長い

// 3. 自動インクリメント整数
id  Int     @id @default(autoincrement())
// 生成場所：PostgreSQL
// 例：      1, 2, 3, 4, ...
// 特徴：    シンプル、予測可能（セキュリティ注意）

// 4. MongoDB ObjectID
id  String  @id @default(auto()) @db.ObjectId @map("_id")
// 生成場所：MongoDB
// 例：      "507f1f77bcf86cd799439011"
// 特徴：    MongoDB専用
```

## なぜCUIDを使うのか？

### メリット

| メリット | 説明 |
|---------|------|
| ✅ URL適合性 | ハイフンがないのでURLに使いやすい |
| ✅ コンパクト | UUIDより短い（25文字 vs 36文字） |
| ✅ ソート可能 | タイムスタンプ順にソート可能 |
| ✅ セキュア | 予測不可能でセキュリティ向上 |
| ✅ 分散対応 | 複数サーバーで同時生成しても衝突しない |
| ✅ DB非依存 | PostgreSQL、MySQL等どのDBでも使える |

### 整数IDとの違い

**整数ID（autoincrement）の問題点：**
```
/users/1      ← 予測可能！
/users/2      ← 順番に試せる
/users/3      ← セキュリティリスク
```

**CUIDの利点：**
```
/users/clxyz123abc...  ← 予測不可能
/users/clabc456def...  ← ランダム
/users/cldef789ghi...  ← セキュア
```

## まとめ

### 開発者が覚えるべきポイント

1. **`@default(cuid())`は自動生成される**
   - コードで`id`を指定する必要はない
   - Prisma Clientが自動で生成する

2. **生成はプログラム側**
   - DBではなくPrisma Client（Node.js）で生成
   - DBには生成済みの値が送信される

3. **レコード作成前にIDが分かる**
   ```typescript
   const employee = await prisma.employee.create({ ... });
   console.log(employee.id); // すぐに使える
   ```

4. **このプロジェクトではCUIDを採用**
   - セキュリティとスケーラビリティを重視
   - URLに使いやすく、予測不可能

### 実装時の注意点

```typescript
// ✅ 正しい：idは指定しない
await prisma.employee.create({
  data: {
    employeeCd: "EMP000001",
    email: "test@example.com",
    name: "山田太郎",
  }
});

// ❌ 間違い：idを手動で指定する必要はない（できるけど通常不要）
await prisma.employee.create({
  data: {
    id: "何か手動で生成したID", // 通常は不要
    employeeCd: "EMP000001",
    // ...
  }
});
```

## 参考リンク

- [Prisma - ID fields](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#id-fields)
- [CUID specification](https://github.com/paralleldrive/cuid)
- [UUID vs CUID comparison](https://blog.bitsrc.io/why-cuid-is-better-than-uuid-for-database-ids-602eaa14b7e5)
