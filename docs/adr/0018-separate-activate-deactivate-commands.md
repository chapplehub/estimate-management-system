# ADR-0018: エンティティの有効/無効切り替えを専用コマンドで実装する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-04-14 |
| 最終更新日 | 2026-04-14 |

## コンテキスト

マスタエンティティ（商品・得意先・納品先など）には有効/無効（isActive）の状態切り替え機能がある。この切り替えを「更新コマンド（UpdateXxx）の一部として実装する」か「専用コマンド（ActivateXxx / DeactivateXxx）として分離する」かの判断が必要になった。

商品（Product）では既に専用コマンド方式で実装されていたが、明文化された方針がなく、得意先（Customer）への展開を機に設計方針を統一する。

## 検討した選択肢

### A. 更新コマンドの一部として実装する（不採用）

UpdateCustomerCommand の入力に `isActive` フィールドを含め、編集フォーム内のチェックボックスで切り替える。

```typescript
type UpdateCustomerInput = {
  id: string;
  name: string;        // 必須フィールド
  postalCode?: string;
  // ...
  isActive?: boolean;  // 更新コマンドに含める
};
```

### B. 専用コマンドで実装する（採用）

ActivateXxxCommand / DeactivateXxxCommand を分離し、UI もトグルボタンとして独立させる。

```typescript
type ActivateCustomerInput = { id: string };
type DeactivateCustomerInput = { id: string };
```

## 決定

エンティティの有効/無効切り替えは、更新コマンドから分離した専用コマンド（ActivateXxx / DeactivateXxx）で実装する。

## 根拠

1. **操作の意図が異なる**: 「情報を編集する」と「有効/無効を切り替える」はドメイン上の意図が異なる操作である。UpdateCommand は属性の変更、Activate/Deactivate は状態遷移であり、責務を分離することで意図が明確になる

2. **入力の最小化**: 状態切り替えに必要なのは `{ id }` のみ。UpdateCommand を経由すると、name 等の必須フィールドも渡す必要があり、現在のデータを取得してそのまま再送するという不自然なフローになる

3. **ビジネスルールの独立性**: 「すでに有効な場合は有効化できない」等のガードは、更新処理のバリデーションとは独立した関心事である

4. **既存パターンとの一貫性**: Product で既に専用コマンド方式が採用されており（`ActivateProductCommand` / `DeactivateProductCommand`）、他のエンティティも同じパターンに揃える

### 不採用理由（選択肢A）

- UpdateCommand に isActive を含めると、name 等の必須フィールドが常に必要になり、状態切り替えのために全フィールドを再送する必要がある
- UI 上の「編集を保存」と「有効/無効を切り替え」の操作が混在し、ユーザーの意図が不明確になる
- 将来的に権限や監査ログを操作種別ごとに分けたい場合に対応しづらい

## 影響

- 新しいマスタエンティティを追加する際は、UpdateXxxCommand とは別に ActivateXxxCommand / DeactivateXxxCommand を作成する
- UI では編集フォームとは独立したトグルボタンとして配置する（ProductStatusForms パターン）
- リダイレクト理由も UPDATED とは別に ACTIVATED / DEACTIVATED を定義する
- エンティティの `activate()` / `deactivate()` メソッドが前提となる（既存エンティティは対応済み）
