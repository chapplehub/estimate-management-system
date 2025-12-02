# コードスタイル・規約

## 基本スタイル
- **インデント**: スペース 2 個
- **セミコロン**: 必須
- **クォート**: シングルクォート (`'`)
- **末尾カンマ**: 複数行の場合は必須
- **行の長さ**: 最大 100 文字

## 命名規則

| 種類 | 規則 | 例 |
|------|------|-----|
| ファイル（クラス/コンポーネント） | PascalCase | `Employee.ts` |
| ファイル（関数/ユーティリティ） | camelCase | `userUtils.ts` |
| クラス | PascalCase | `CreateEmployeeCommand` |
| インターフェース | I接頭辞 + PascalCase | `IEmployeeRepository` |
| 型エイリアス | PascalCase | `EmployeeDTO` |
| 変数・関数 | camelCase | `employeeName`, `getEmployee()` |
| 定数 | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |
| Private 変数 | _接頭辞 + camelCase | `_employeeId` |
| Boolean 変数 | is/has/can/should接頭辞 | `isActive`, `hasPermission` |

## DDD 命名規則

### エンティティ
- 名詞（単数形）: `Employee`, `User`
- ファクトリメソッド: `create()` (新規), `reconstruct()` (DB復元)

### Value Object
- 名詞: `EmployeeCd`, `Email`, `Password`
- イミュータブル（コンストラクタでバリデーション）

### Repository
- インターフェース: `IEmployeeRepository`
- 実装: `PrismaEmployeeRepository`, `InMemoryEmployeeRepository`

### Command/Query (CQRS)
- Command: `CreateEmployeeCommand`, `UpdateEmployeeCommand`
- Query: `GetEmployeeByIdQuery`, `SearchEmployeesQuery`

### Domain Service
- 動詞 + Service: `EmployeeCdDuplicationCheckDomainService`

## TypeScript 規則
- **strict モード有効**
- **any 型禁止**（unknown を使用）
- 関数の引数・戻り値は明示的に型アノテーション

## エラー階層
```
AppError (基底)
├── DomainError (400系)
│   ├── ValidationError
│   └── BusinessRuleViolationError
├── NotFoundError (404)
├── UnauthorizedError (401)
├── ForbiddenError (403)
└── InfrastructureError (500系)
```

## ファイル構成順序
1. 外部ライブラリのインポート
2. 内部モジュールのインポート（@/ エイリアス使用）
3. 型定義
4. 定数
5. メインコード

## コーディング原則
- **関数は50行以内**
- **早期リターン**（ネストを浅く）
- **DRY原則**（共通処理は関数化）
- **SOLID原則**（特に単一責任）
