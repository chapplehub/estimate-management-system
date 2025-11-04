# CQRS パターンにおけるCommand/Query の命名規則

## 概要

ApplicationServiceが大きくなってきたため、各publicメソッドをクラスに分割する際の命名方法について整理。

**結論：Command/Query で明確に分離し、それぞれ異なる命名規則を採用する。**

## CQRS（Command Query Responsibility Segregation）とは

データの**書き込み操作**と**読み取り操作**を明確に分離する設計パターン。

- **Command（コマンド）**: データを変更する操作（Create, Update, Delete）
  - 副作用がある
  - 通常、戻り値は void または変更結果のID程度

- **Query（クエリ）**: データを読み取る操作（Get, Search, Count）
  - 副作用がない（データを変更しない）
  - 必ず何らかのデータを返す

## 命名規則

### Command（書き込み操作）

**パターン**: `{動詞}{対象エンティティ}Command`

| 操作 | クラス名 | 例 |
|------|---------|-----|
| 新規作成 | `Create{Entity}Command` | `CreateEmployeeCommand` |
| 更新 | `Update{Entity}Command` | `UpdateEmployeeCommand` |
| 削除 | `Delete{Entity}Command` | `DeleteEmployeeCommand` |
| 特殊操作 | `{動詞}{Entity}Command` | `ActivateEmployeeCommand`, `LockEmployeeCommand` |

**動詞の選び方**:
- **Create**: 全く新しいエンティティを作成
- **Update**: 既存エンティティの情報を変更
- **Register**: ユーザー登録のような特殊な作成操作
- **Activate/Deactivate**: 状態変更
- **Lock/Unlock**: ロック操作

### Query（読み取り操作）

**パターン**: `{動詞}{対象エンティティ}By{検索条件}Query` または `{動詞}{対象エンティティ}Query`

| 操作 | クラス名 | 例 |
|------|---------|-----|
| ID検索 | `Get{Entity}ByIdQuery` | `GetEmployeeByIdQuery` |
| 単一条件検索 | `Get{Entity}By{Field}Query` | `GetEmployeeByEmailQuery`, `GetEmployeeByEmployeeCdQuery` |
| 全件取得 | `GetAll{Entities}Query` | `GetAllEmployeesQuery` |
| 複数条件検索 | `Search{Entities}Query` | `SearchEmployeesQuery` |
| 件数カウント | `Count{Entities}Query` | `CountEmployeesQuery` |

**動詞の選び方**:
- **Get**: 単一または特定の結果を取得（GetById, GetByEmail など）
- **GetAll**: 全件取得
- **Search**: 複数の条件で検索
- **Count**: 件数をカウント
- **Find**: Get と似ているが、より探索的なニュアンス（プロジェクトによって使い分ける）

### 実行メソッドの統一

全てのCommand/Queryクラスは **`execute()`** メソッドを持つ。

```typescript
// Command
class CreateEmployeeCommand {
  async execute(input: CreateEmployeeInput): Promise<void> {
    // ...
  }
}

// Query
class GetEmployeeByIdQuery {
  async execute(input: GetEmployeeByIdInput): Promise<EmployeeDTO | null> {
    // ...
  }
}
```

**統一する理由**:
1. **一貫性**: 全てのユースケースが同じインターフェースを持つ
2. **予測可能性**: どのクラスも `execute()` を呼べば動作する
3. **拡張性**: デコレーターパターンやミドルウェアを適用しやすい
4. **可読性**: クラス名で「何を」、execute()で「実行」が明確

## ディレクトリ構造

**Entity単位でディレクトリを切る構造を採用**

```
application/
├── Employee/
│   ├── commands/
│   │   ├── CreateEmployeeCommand.ts
│   │   ├── UpdateEmployeeCommand.ts
│   │   └── __tests__/
│   │       ├── CreateEmployeeCommand.test.ts
│   │       └── UpdateEmployeeCommand.test.ts
│   └── queries/
│       ├── GetEmployeeByIdQuery.ts
│       ├── GetEmployeeByEmailQuery.ts
│       ├── GetEmployeeByEmployeeCdQuery.ts
│       ├── GetAllEmployeesQuery.ts
│       ├── SearchEmployeesQuery.ts
│       ├── CountEmployeesQuery.ts
│       └── __tests__/
│           ├── GetEmployeeByIdQuery.test.ts
│           ├── GetEmployeeByEmailQuery.test.ts
│           └── ...
├── Project/          # 将来追加されるエンティティ
│   ├── commands/
│   └── queries/
└── Department/       # 将来追加されるエンティティ
    ├── commands/
    └── queries/
```

### 代替案との比較

**案1: Entity > Command/Query（採用）**
```
application/
├── Employee/
│   ├── commands/
│   └── queries/
```

**案2: Command/Query > Entity（不採用）**
```
application/
├── commands/
│   ├── Employee/
│   └── Project/
└── queries/
    ├── Employee/
    └── Project/
```

### Entity単位でディレクトリを切る理由

1. **スケーラビリティ**: エンティティが増えても見通しが良い
   - `Project`, `Department`, `Estimate` などが増えても、各エンティティ配下で完結
   - Command/Query別に切ると、エンティティが増えるとフラットに並んで見にくくなる

2. **凝集度**: 関連する操作がまとまっている
   - Employee関連の全操作（読み書き）が1箇所に集約
   - チーム開発で「Employeeの担当」が明確

3. **並行開発**: 異なるエンティティを異なる開発者が担当しやすい
   - マージコンフリクトが起きにくい

4. **削除・移動が容易**: エンティティごとにディレクトリを削除/移動できる
   - 不要になった機能の削除が簡単

5. **DDDの原則に沿う**: ドメインモデル（Entity）が中心
   - 技術的な分類（Command/Query）より、ドメイン概念（Employee, Project）が上位

**利点まとめ**:
- Command/Queryが物理的に分離されている（Entity内で）
- 依存関係が明確（Commandは書き込み、Queryは読み取り専用）
- テストも同様に分離
- エンティティ単位で完結し、スケーラブル

## 依存関係の違い

### Command の依存関係

```typescript
export class CreateEmployeeCommand {
  public constructor(
    private readonly employeeRepository: IEmployeeRepository,  // 書き込み用Repository
    private readonly duplicationCheckService: EmployeeCdDuplicationCheckDomainService  // ドメインサービス
  ) {}
}
```

- **Repository（書き込み用）**: `save()`, `delete()` などを使用
- **DomainService**: ビジネスルールのチェック
- データを変更するため、トランザクション管理が必要な場合がある

### Query の依存関係

```typescript
export class GetEmployeeByIdQuery {
  public constructor(
    private readonly employeeQueryService: IEmployeeQueryService  // 読み取り専用QueryService
  ) {}
}
```

- **QueryService（読み取り専用）**: `findById()`, `search()` などを使用
- Repositoryではなく専用のQueryServiceを使うことで、読み取り最適化が可能
- 副作用がないため、キャッシュ等の最適化がしやすい

## なぜ Command/Query で分けるべきか

1. **責任の明確化**
   - 書き込み操作と読み取り操作では、求められる特性が異なる
   - Command: 整合性、トランザクション、検証
   - Query: パフォーマンス、キャッシュ、結合最適化

2. **依存関係の最適化**
   - Queryは読み取り専用なので、QueryServiceのみに依存
   - Commandは書き込みとドメインロジックに依存

3. **将来の拡張性**
   - 読み取り専用DBレプリカへの振り分け
   - QueryとCommandで異なるスケーリング戦略
   - イベントソーシングへの移行が容易

4. **テストの簡潔化**
   - Queryのテストはモックが単純（QueryServiceのみ）
   - Commandのテストは検証ロジックに集中できる

## 代替案: UseCase で統一する方法

全て `{動詞}{対象}UseCase` にする方法もある。

**例**:
- `CreateEmployeeUseCase`
- `GetEmployeeByIdUseCase`
- `SearchEmployeesUseCase`

**メリット**:
- ドメイン駆動設計の「ユースケース」という概念と一致
- シンプルで統一感がある

**デメリット**:
- Command/Queryの区別が名前から分からない
- 依存関係の違いが不明確

**結論**: 小規模プロジェクトなら UseCase で統一も可。今回は CQRS を明示的に表現するため Command/Query 分離を採用。

## 実装例の比較

### Before: 単一のApplicationService

```typescript
export class EmployeeApplicationService {
  async register(command: RegisterEmployeeCommand): Promise<void> { ... }
  async change(command: ChangeEmployeeCommand): Promise<void> { ... }
  async getById(id: string): Promise<EmployeeDTO | null> { ... }
  async search(criteria: EmployeeSearchCriteria): Promise<EmployeeDTO[]> { ... }
  // ... メソッドが増え続ける
}
```

**問題点**:
- クラスが肥大化
- 全ての依存関係を持つ（Repository, QueryService, DomainService等）
- テストが複雑

### After: Command/Query分離

```typescript
// Command
export class CreateEmployeeCommand {
  async execute(input: CreateEmployeeInput): Promise<void> { ... }
}

// Query
export class GetEmployeeByIdQuery {
  async execute(input: GetEmployeeByIdInput): Promise<EmployeeDTO | null> { ... }
}
```

**利点**:
- 各クラスが単一責任（SRP）
- 必要な依存関係のみを持つ
- テストが簡潔
- 並行開発がしやすい

## まとめ

- **Command**: `{動詞}{Entity}Command` + `execute()` メソッド
- **Query**: `{動詞}{Entity}By{条件}Query` + `execute()` メソッド
- **ディレクトリ**: `application/{Entity}/commands/` と `application/{Entity}/queries/` で**Entity単位**に分離
- **依存関係**: Command は Repository + DomainService、Query は QueryService のみ
- **理由**: CQRS パターンを明示的に表現し、責任を明確化するため

この命名規則により、コードを見ただけで「書き込みか読み取りか」「どのエンティティか」「どんな操作か」が一目で分かる。

**Entity単位でディレクトリを切ることで、スケーラビリティと保守性が大幅に向上する。**
