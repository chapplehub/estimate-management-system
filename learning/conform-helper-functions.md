# Conform ヘルパー関数（getFormProps, getInputProps）の効果と仕組み

作成日: 2025-12-27

## 概要

`@conform-to/react` のヘルパー関数 `getFormProps` と `getInputProps` が実際に何を返すのか、そしてaria属性がどのタイミングで設定されるのかを理解した。

## 詳細

### getFormProps が返すプロパティ

```typescript
// 手動で書く場合（Before）
<form
  id={form.id}
  onSubmit={form.onSubmit}
  noValidate={form.noValidate}
  aria-describedby={!form.valid ? form.errorId : undefined}
/>

// getFormProps を使う場合（After）
<form {...getFormProps(form)} />
```

**実際にDOMに反映される属性：**
- `id="_r_0_"` - フォームの一意識別子
- `novalidate=""` - ブラウザのネイティブバリデーションを無効化
- `aria-describedby` - フォーム全体にエラーがある時のみ設定

### getInputProps が返すプロパティ

```typescript
// 手動で書く場合（Before）
<input
  key={fields.task.key}
  id={fields.task.id}
  name={fields.task.name}
  form={fields.task.formId}
  defaultValue={fields.task.initialValue}
  aria-invalid={!fields.task.valid || undefined}
  aria-describedby={!fields.task.valid ? fields.task.errorId : undefined}
  required={fields.task.required}
  minLength={fields.task.minLength}
  maxLength={fields.task.maxLength}
  min={fields.task.min}
  max={fields.task.max}
  step={fields.task.step}
  pattern={fields.task.pattern}
  multiple={fields.task.multiple}
/>

// getInputProps を使う場合（After）
<input {...getInputProps(fields.task, { type: 'text' })} />
```

**実際にDOMに反映される属性：**
- `id="_r_0_-name"` - labelのhtmlForと紐づく
- `form="_r_0_"` - 所属するformのID
- `name="name"` - フォーム送信時のキー名
- `type="text"` - 第2引数で指定したtype

### aria属性が見えない理由

**重要な発見：aria属性はエラーがある時のみ設定される**

```typescript
aria-invalid={!fields.task.valid || undefined}
// → valid=true の時は undefined（属性なし）

aria-describedby={!fields.task.valid ? fields.task.errorId : undefined}
// → valid=true の時は undefined（属性なし）
```

DevToolsでaria属性が見えなかったのは、フォームにエラーがなかったため。

**確認方法：**
1. フィールドに何か入力
2. 全て消す
3. フォーカスを外す（blur）
4. DevToolsでinput要素を確認

すると以下が表示される：
- `aria-invalid="true"`
- `aria-describedby="_r_0_-name-error"`

### constraint オプションについて

`getZodConstraint` を使うと、Zodスキーマから制約属性（required, minLength等）を自動抽出してDOMに設定できる。ただし：

- `noValidate` + `onValidate` を使用している場合、ブラウザのネイティブバリデーションは無効
- 制約属性がなくても `onValidate` でJavaScriptバリデーションが動作する
- そのため `constraint` オプションは省略可能

### まとめ

| ヘルパー関数 | 常に設定される属性 | エラー時のみ設定される属性 |
|------------|------------------|------------------------|
| `getFormProps` | id, noValidate, onSubmit | aria-describedby |
| `getInputProps` | id, name, form, type, defaultValue | aria-invalid, aria-describedby |

## 参考

- [Conform公式ドキュメント - getFormProps](https://conform.guide/api/react/getFormProps)
- [Conform公式ドキュメント - getInputProps](https://conform.guide/api/react/getInputProps)
- 関連ファイル: `src/app/(features)/employees/new/EmployeeCreateForm.tsx`
