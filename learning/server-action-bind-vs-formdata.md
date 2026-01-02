# Server Actionでbind()を使う場面とFormDataの使い分け

作成日: 2026-01-02

## 概要

Server Actionに値を渡す方法として、FormData経由で渡す方法と`bind()`で事前にバインドする方法がある。URLパラメータから取得したリソース識別子（employeeCdなど）は、FormDataではなく`bind()`で渡すべき。

## 詳細

### HTMLの仕様: disabled vs readOnly

| 属性 | FormDataに含まれる | ユーザー編集 | フォーカス |
|------|------------------|-------------|-----------|
| `readOnly` | ✅ 含まれる | ❌ 不可 | ✅ 可能 |
| `disabled` | ❌ 含まれない | ❌ 不可 | ❌ 不可 |

`disabled`属性が付いた入力フィールドの値は、HTML標準の仕様によりFormDataに含まれない。

### bind()を使うべき場面

1. **URLパラメータから取得した値**（employeeCd, idなど）
2. **ログインユーザーのID**
3. **フォームUIには表示しないがActionで必要な値**

基本原則: **フォームの編集対象ではない値はbind()で渡す**

### なぜbind()を使うのか

```tsx
// EmployeeUpdateForm.tsx
const updateEmployeeWithEmployeeCd = updateEmployee.bind(
  null,
  employee.employeeCd  // サーバーコンポーネントから渡された値
);
```

1. **設計意図の明確化**: employeeCdは「どのリソースを操作するか」を示す識別子であり、フォームの入力値ではない
2. **スキーマとの整合性**: ConformのバリデーションスキーマにはemployeeCdを含めない設計にできる
3. **セキュリティ**: FormData経由の値はDevToolsで改ざん可能。bind()経由でも完全に安全ではないが、認可チェックと組み合わせて使用
4. **UI/UX**: `disabled`属性で「編集不可」を視覚的に明確に伝えられる

### スキーマ設計

```typescript
// schema.ts
/**
 * 従業員更新フォームのバリデーションスキーマ
 * 基盤スキーマのみ（id, employeeCdはURLパラメータから取得）
 */
export const updateEmployeeSchema = employeeBaseSchema;
```

URLパラメータ経由で取得する値はスキーマに含めず、Server Actionの引数として受け取る。

### Server Actionのシグネチャ

```typescript
// actions.ts
export async function updateEmployee(
  employeeCd: string,      // bind()で渡される
  prevState: unknown,      // useActionStateから渡される
  formData: FormData       // フォーム送信時に渡される
) {
  // ...
}
```

### セキュリティに関する重要な補足

**bind()も完全には安全ではない。**

Next.jsのServer Actionでは、`bind()`された値は：
1. シリアライズされてクライアントに渡される（暗号化される）
2. 実行時にサーバーに戻される

技術的には解析・改ざんの余地がある。FormDataよりは難しいが、不可能ではない。

#### 改ざん耐性の比較

| 方式 | 改ざん難易度 |
|------|-------------|
| FormData / hidden input | 簡単（DevToolsで即座に可能） |
| bind() | 難しい（暗号化されるが不可能ではない） |
| Server側での認可チェック | **最終的なセキュリティ担保** ✅ |

#### 結論

「センシティブなデータはbindで渡せば安全」ではなく、**「フォームの編集対象ではないリソース識別子はbindで渡し、必ず認可チェックも行う」** という多層防御が正しいアプローチ。

```typescript
// actions.ts での認可チェック例
export async function updateEmployee(employeeCd: string, ...) {
  // employeeCdからidを取得
  const employee = await queryService.findByEmployeeCd(employeeCd);

  // 認可チェック: 本人または管理者のみ操作可能
  await verifyOwnerOrAdmin(employee.id);  // ← これが最終的なセキュリティ担保

  // ...
}
```

## 参考

- 関連ファイル:
  - `src/app/(features)/employees/[employeeCd]/EmployeeUpdateForm.tsx`
  - `src/app/(features)/employees/[employeeCd]/actions.ts`
  - `src/app/(features)/employees/[employeeCd]/schema.ts`
- HTML仕様: disabled属性 - https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#enabling-and-disabling-form-controls:-the-disabled-attribute
