# 認証・認可チェックの配置とセキュリティ

## 概要

認証・認可チェックをクライアントサイドに移してはいけない理由と、「表示用」と「保護用」の区別についての学び。

## 背景

フルルートキャッシュを有効にするためにセッション読み取り（useSession）をクライアントに移した際、認証・認可チェック（verifySession/verifyAdmin）も同様にクライアントに移せるのではないかという疑問が生じた。

結論：**認証・認可チェックは絶対にクライアントに移してはいけない**

## 「表示用」と「保護用」の区別

| 種類 | 目的 | 配置 | バイパスされた場合 |
|------|------|------|------------------|
| **表示用**（useSession） | UI表示の分岐 | クライアント可 | 表示がおかしくなるだけ |
| **保護用**（verifySession/verifyAdmin） | データ操作の保護 | **サーバー必須** | **データ破壊・漏洩** |

### 表示用の例

```typescript
// クライアントでOK - バイパスされても被害なし
const { data: session } = useSession();
return session?.user.role === "ADMIN" ? <AdminMenu /> : null;
```

### 保護用の例

```typescript
// サーバー必須 - バイパスされるとデータが破壊される
export async function deleteEmployeeAction(employeeId: string) {
  await verifyAdmin(); // ← これがないと誰でも削除できてしまう
  await employeeRepository.delete(employeeId);
}
```

## クライアントで認可チェックする危険性

### 攻撃シナリオ

もしクライアントで認可チェックをすると：

```typescript
// 危険なパターン
const { data: session } = useSession();
if (session?.user.role === "ADMIN") {
  await deleteEmployeeAction(employeeId);
}
```

攻撃者は：

1. ブラウザのDevToolsを開く
2. `deleteEmployeeAction(employeeId)` を直接呼び出す
3. クライアントのif文を完全にバイパス
4. Server Action側で認可チェックしていなければ、削除が実行される

### 根本的な問題

- **クライアントサイドのコードは信頼できない**
- ブラウザで実行されるJavaScriptは、ユーザーが自由に改変・バイパスできる
- 認可決定は必ず**信頼できる環境（サーバー）**で行う必要がある

## 「DBを見に行っていない」は関係ない

verifySession/verifyAdminがDBを直接参照していなくても、問題の本質は変わらない：

- **サーバーでチェック**: セッション情報はサーバーが発行したもの（信頼できる）
- **クライアントでチェック**: 攻撃者がセッション情報を偽装できる（信頼できない）

## 正しいアーキテクチャ

```
【表示用】クライアント
├── useSession() でセッション取得
└── UI表示の分岐に使用（管理者メニュー表示など）
    └── バイパスされても被害なし

【保護用】サーバー（Server Action）
├── verifySession() / verifyAdmin() で認証・認可チェック
└── データ操作の保護（作成・更新・削除）
    └── これがないと誰でもデータを操作できてしまう
```

## unauthorized() vs ActionResult

現在の実装では `unauthorized()` を使って直接画面制御しているが、これを改善する場合：

```typescript
// 現在の実装
export async function verifyAdmin() {
  if (session.user.role !== "ADMIN") {
    unauthorized(); // 直接画面制御
  }
}

// 改善案（認可チェックはサーバー、画面制御はフロント）
export async function deleteEmployeeAction(employeeId: string) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, error: "権限がありません" };
  }
  // 処理続行...
  return { success: true };
}
```

**重要**: 改善案でも認可チェック自体は必ずサーバーで行う。クライアントは結果を受け取って画面制御するだけ。

## 結論

- **表示用**（useSession）: クライアントに置いてOK
- **保護用**（verifySession/verifyAdmin）: **サーバーに置くのはセキュリティ上の必須要件**
- 「DBを見に行っていない」「プレゼンテーション層でしか使っていない」は関係ない
- クライアントは信頼できない環境であり、認可決定は必ずサーバーで行う

## 関連ファイル

- `src/server/shared/auth/verify/authentication.ts` - 認証チェック
- `src/server/shared/auth/verify/authorization.ts` - 認可チェック
- `src/app/_lib/auth-client.ts` - クライアント用セッション読み取り（表示用）
- `learning/auth-responsibilities-and-changeability.md` - 関連する設計判断
