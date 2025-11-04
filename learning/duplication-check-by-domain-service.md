# ドメインサービスによる重複チェックは適切か？

## 概要

`EmployeeCdDuplicationCheckDomainService`のような「DBで重複していないか確認する処理」をドメインサービスとして実装することは、DDD的に適切なのか？という疑問について整理。

**結論：適切である。むしろ推奨される実装パターン。**

## 疑問の背景

- ドメインサービスは「エンティティ単独では実現できない処理を仕方なく書く場所」という認識
- 単にDBを検索しているだけなのに、わざわざドメインサービスにする必要があるのか？
- アプリケーションサービスで直接リポジトリを呼べば良いのでは？

## ドメインサービスが適切な理由

### 1. 一意性制約はドメインルール

`EmployeeCd`が一意であることは**ビジネス上の制約**であり、ドメイン知識である。
- 技術的な制約（DB制約）ではなく、ビジネスルール
- 「従業員コードは重複してはならない」という業務上の要求事項

### 2. エンティティ単独では実現できない

`Employee`エンティティ単体では「自分が重複しているか」を判断できない。
- 他の`Employee`インスタンスと比較する必要がある
- リポジトリ経由で他のエンティティを検索する必要がある
→ これがまさに「エンティティ単独では実現できない処理」

### 3. 複数エンティティにまたがる処理

ある`EmployeeCd`が既存の**全ての`Employee`**と重複していないかを判断する処理は、複数エンティティにまたがる。
- 単一エンティティのメソッドとして置くのは不自然
- かといってアプリケーション層に置くとドメインロジックが漏れる

## 他のアプローチとの比較

### アプローチ1: ドメインサービス（現在の実装）✅

```typescript
export class EmployeeCdDuplicationCheckDomainService {
  constructor(private employeeRepository: IEmployeeRepository) {}

  async execute(employeeCd: EmployeeCd): Promise<boolean> {
    const duplicated = await this.employeeRepository.findByEmployeeCd(employeeCd);
    return !!duplicated;
  }
}
```

**メリット:**
- ドメインルールが明示的で可視化されている
- 再利用可能（複数のユースケースで使える）
- テスト容易（モックリポジトリで単体テスト可能）
- 将来の複雑化に対応しやすい（例：「無効化された従業員は重複とみなさない」）

**デメリット:**
- クラスが1つ増える
- 現時点では「単純な検索」なので過剰に見えるかもしれない

### アプローチ2: アプリケーションサービスに直接書く

```typescript
// EmployeeApplicationService内
async register(command: RegisterEmployeeCommand): Promise<void> {
  const employeeCd = new EmployeeCd(command.employeeCd);

  // 重複チェックをここに直接書く
  const existing = await this.employeeRepository.findByEmployeeCd(employeeCd);
  if (existing) {
    throw new ValidationError("既に存在する従業員CDです");
  }

  // ...
}
```

**デメリット:**
- ドメインロジック（一意性制約）がアプリケーション層に漏れる
- 複数のユースケースで同じチェックが必要な場合、コード重複する
- 「従業員コードは一意でなければならない」というルールが分散する

### アプローチ3: リポジトリに`exists`メソッドを追加

```typescript
interface IEmployeeRepository {
  findById(id: string): Promise<Employee | null>;
  findByEmployeeCd(cd: EmployeeCd): Promise<Employee | null>;
  existsByEmployeeCd(cd: EmployeeCd): Promise<boolean>; // 追加
  save(employee: Employee): Promise<void>;
}
```

**メリット:**
- ドメインサービスを作らなくて済む
- シンプル

**デメリット:**
- リポジトリが肥大化する（`existsByEmail`、`existsByXxx`も全部追加？）
- 「存在チェック」という技術的な操作と「一意性制約」というドメインルールが混同される
- 将来「重複の定義」が複雑になった場合、リポジトリに複雑なロジックが入る

## DDD文献での見解

### Vaughn Vernon「実践ドメイン駆動設計」

リポジトリを使った一意性チェックは、**ドメインサービスの代表的な例**として挙げられている。

> 「エンティティや値オブジェクトに自然には属さないが、ドメインにとって重要な操作は、ドメインサービスとしてモデル化する」

### Eric Evans「ドメイン駆動設計」

> 「ドメインサービスは慎重に使うべき」としつつ、「エンティティに置けない重要なドメインの操作」の例として一意性チェックを認めている。

## グレーゾーンである理由

この実装が「完全に正解」とも言い切れない理由：

1. **現時点では単純すぎる**
   - 単なる`findByEmployeeCd`のラッパーに見える
   - わざわざクラスを作る必要があるのか？

2. **将来の複雑化次第**
   - 「無効化された従業員は重複とみなさない」
   - 「同じ部署内でのみ一意」
   - などのルールが追加されれば、ドメインサービスの価値が明確になる

3. **リポジトリでも実現可能**
   - `exists`メソッドをリポジトリに追加すれば、ドメインサービス不要

## 実装判断の基準

**ドメインサービスにすべき場合:**
- ビジネスルールとして明示的に表現したい
- 将来的に複雑化する可能性がある
- 複数のユースケースで再利用される

**リポジトリの`exists`メソッドで良い場合:**
- 完全に単純な存在チェックで、今後も複雑化しない
- 1つのユースケースでしか使わない
- チーム内で「exists系メソッドはリポジトリに置く」というルールがある

## 現在のプロジェクトでの判断

**`EmployeeCdDuplicationCheckDomainService`は適切**

理由：
1. 「従業員コードは一意」というビジネスルールが明示的になる
2. 従業員登録・変更など複数のユースケースで再利用可能
3. 将来的に「無効従業員は除外」などのルール追加の余地
4. テスト容易性が高い
5. ドメイン層に閉じている（依存関係が適切）

## 関連ファイル

- `/web/src/domain/services/Employee/EmployeeCdDuplicationCheckDomainService.ts`
- `/web/src/domain/services/Employee/EmployeeCdDuplicationCheckDomainService.test.ts`
- `/web/src/application/EmployeeApplicationService.ts`

## 参考

- Vaughn Vernon「実践ドメイン駆動設計」第7章「サービス」
- Eric Evans「ドメイン駆動設計」第5章「ソフトウェアで表現されるモデル」
