# ADR-0011: Domain Serviceの設計パターンを責務の性質で使い分ける

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-04-08 |
| 最終更新日 | 2026-04-08 |

## コンテキスト

Domain Serviceの実装が増える中で、2つの異なるパターンが混在していることが判明した。

- **重複チェック系**（7サービス）: `Promise<boolean>` を返し、呼び出し側のCommandがエラーハンドリングを担う
- **SuperiorRoleValidationDomainService**（1サービス）: Domain Service自身が `BusinessRuleViolationError` をthrowする

この構造の違いが意図的な設計判断なのか、単なる一貫性の欠如なのかを明確にし、今後のDomain Service実装の指針を定める必要がある。

## 検討した選択肢

### A. 全Domain Serviceをboolean返却に統一する（不採用）

```typescript
// SuperiorRoleValidationDomainService もbooleanを返す形に変更
async execute(positionId: string, superiorRoleId: string): Promise<boolean> {
  const superiorPositionId = await this.positionRepository.findSuperiorPositionId(positionId);
  if (superiorPositionId === null) return false;
  // ...
}
```

複数の失敗理由（「最上位役職だから不可」「上位役割が存在しない」「役職が一致しない」）を単一のboolean で表現できず、呼び出し側が失敗理由を判別するために同じロジックを再実装する必要がある。

### B. 全Domain Serviceを直接throw方式に統一する（不採用）

```typescript
// 重複チェック系もthrowする形に変更
async execute(employeeCd: EmployeeCd): Promise<void> {
  const duplicated = await this.employeeRepository.findByEmployeeCd(employeeCd);
  if (duplicated) {
    throw new ValidationError("既に存在する従業員CDです");
  }
}
```

重複チェックの結果をエラーにするかどうかは呼び出し側の文脈に依存する。例えばCreateでは重複はエラーだが、Updateでは自分自身との重複は許容する（`excludeId`パターン）。Domain Serviceがエラーメッセージを決めると、この柔軟性が失われる。

### C. 責務の性質に応じてパターンを使い分ける（採用）

- **事実確認型**: boolean返却。呼び出し側がエラーハンドリングの責務を持つ
- **ルール検証型**: 直接throw。Domain Serviceがエラーメッセージの責務を持つ

## 決定

Domain Serviceの設計パターンを、責務の性質に応じて「事実確認型」と「ルール検証型」の2つに分けて使い分ける。

## 根拠

### 事実確認型（boolean返却）が適するケース

- 判定結果が true / false の2値で十分に表現できる
- 同じ事実確認を異なる文脈で再利用する可能性がある（Create vs Update）
- エラーメッセージの決定権は呼び出し側にある

現行の重複チェック系7サービスがこれに該当する:
`EmployeeCdDuplicationCheckDomainService`, `MailAddressDuplicationCheckDomainService`, `DepartmentCdDuplicationCheckDomainService`, `CustomerCodeDuplicationCheckDomainService`, `DeliveryLocationCodeDuplicationCheckDomainService`, `RoleCdDuplicationCheckDomainService`, `RoleNameDuplicationCheckDomainService`

### ルール検証型（直接throw）が適するケース

- 複数の異なる理由で失敗しうる複合的なビジネスルール
- 失敗理由ごとに固有のエラーメッセージが必要
- そのルール自体がドメイン知識であり、Domain Serviceが失敗理由を最もよく知っている

現行の `SuperiorRoleValidationDomainService` がこれに該当する。

### 不採用理由

- **選択肢A（boolean統一）**: 複合ルールの失敗理由をbooleanで表現できない。呼び出し側にドメインロジックが漏洩する
- **選択肢B（throw統一）**: 事実確認の結果をどう扱うかの柔軟性が失われる。重複チェックのCreate/Update共用パターンが破綻する

## 影響

- 新しいDomain Serviceを実装する際に、「事実確認か、ルール検証か」で設計パターンを判断する指針ができる
- エラーメッセージのテスト方針に直結する: 事実確認型のメッセージはCommandテストで、ルール検証型のメッセージはDomain Serviceテストで検証する
- 将来、複合的なビジネスルール（例: 見積承認の前提条件チェック）が増えた場合、ルール検証型パターンの採用が増える可能性がある
