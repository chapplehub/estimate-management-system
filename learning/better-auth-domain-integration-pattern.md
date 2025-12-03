# better-auth とドメインエンティティの統合パターン

## 概要

DDDで設計したドメインエンティティ（Employee）と、認証ライブラリ（better-auth）のコアスキーマ（User/Account）をどのように統合するかの設計パターン。

ドメインの純粋性を保ちながら、外部ライブラリとの統合を実現する方法を検討した。

## 背景・課題

- Employee エンティティ: `id`, `employeeCd`, `email`, `name`, `passwordHash`, `role` などを持つ
- better-auth コアスキーマ: User テーブル（認証主体）と Account テーブル（パスワード等）を使用
- 課題: 両者をどう関連付けるか？ドメインの純粋性をどう保つか？

## 検討した選択肢

| 方法 | 概要 | 評価 |
|------|------|------|
| 方法1: Employee を User として使う | `modelName: "employees"` でテーブル名変更 | ❌ better-auth の詳細がドメインに流入 |
| 方法2: User と Employee を分離 | Employee に `userId` を持たせて関連付け | △ ドメインエンティティに外部参照が入る |
| 方法3: User に Employee を統合 | Employee テーブル廃止、User に統合 | ❌ ドメインエンティティが消失 |
| 方法2': 中間テーブル | UserEmployeeLink で間接参照 | △ 1:1関係には過剰設計 |
| 方法2改: User に employeeId | User 側が Employee を参照 | ✅ 採用 |

## 採用した設計

### レイヤー構造

```
Infrastructure Layer (User, Account, Session - better-auth管理)
    ↓ employeeId で参照
Domain Layer (Employee - 純粋なドメインエンティティ)
```

### スキーマ

```prisma
model User {
  id         String    @id
  employeeId String?   @unique
  employee   Employee? @relation(fields: [employeeId], references: [id])
  // ... better-auth 標準フィールド
}

model Employee {
  id         String  @id
  employeeCd String  @unique
  email      String  @unique
  name       String
  role       Role
  // userId なし - 純粋なドメインエンティティ
}
```

### ポイント

- **Employee は userId を持たない**: 認証ライブラリの存在を知らない
- **User が employeeId を持つ**: インフラ層がドメイン層を参照する方向
- **中間テーブルは不要**: 1:1関係かつ小規模システムでは過剰

## 設計原則

1. **ドメインエンティティの純粋性を最優先**: ドメイン層は外部ライブラリの概念を知らない
2. **依存の方向はインフラ→ドメイン**: DDD のレイヤー構造と一致させる
3. **過剰設計を避ける**: 理論的正しさとシンプルさのバランスを取る
4. **腐敗防止層（ACL）の考え方**: 外部システムの概念がドメインに漏れ出さないよう境界を設計

## 学び

- 外部ライブラリとドメインの統合では「参照の方向」を意識する
- インフラ層がドメイン層を参照する方向なら、ドメインの純粋性を保てる
- シンプルさと理論的正しさのバランスを取る（プロジェクト規模に応じて判断）
- 中間テーブルは「理論的には正しい」が、常に必要とは限らない

## 参考

- better-auth ドキュメント: https://www.better-auth.com/docs/concepts/database
- DDD における腐敗防止層（Anti-Corruption Layer）パターン
- 境界づけられたコンテキスト（Bounded Context）の設計
