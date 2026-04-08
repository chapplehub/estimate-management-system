# 計画からの逸脱記録

## Step 9: UpdateRoleCommand — 自己参照・循環参照のメッセージアサーション除外

### 計画の内容

- 自己参照→`"自分自身を上位役割にすることはできません"`
- 循環→`"循環参照が発生するため、この上位役割は設定できません"`

### 実際の挙動

両ケースとも、UpdateRoleCommandの自前チェックに到達する前に `SuperiorRoleValidationDomainService` が先にバリデーションを実行し、以下のエラーをスロー:

```
上位役割に指定できるのは、選択した役職の上位役職に属する役割のみです
```

### 対応

これらはDomain Serviceからのバブルアップエラーであり、「発生源でテストする」原則に基づきメッセージアサーションを追加しない。`SuperiorRoleValidationDomainService.test.ts` で既にテスト済み。

### 影響

計画で予定していた2つのメッセージアサーション（自己参照・循環）はスキップ。型（BusinessRuleViolationError）のアサーションのみ維持。
