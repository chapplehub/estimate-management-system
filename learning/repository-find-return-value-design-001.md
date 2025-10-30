# リポジトリのfindメソッドの戻り値設計（null vs 例外）

## 疑問・問題

リポジトリの`find`系メソッドで、対象が見つからなかった場合の戻り値設計について、以下の2つの選択肢がある：

1. **null を返す** - `Promise<Entity | null>`
2. **例外を投げる** - `Promise<Entity>` + NotFoundError

どちらを採用すべきか、また使い分けの基準は何か？

## 背景・コンテキスト

現在の実装では、`IEmployeeRepository` のfindメソッドは `Promise<Employee | null>` を返している：

```typescript
export interface IEmployeeRepository {
  findById(id: string): Promise<Employee | null>;
  findByEmail(email: Email): Promise<Employee | null>;
  findByEmployeeCd(employeeCd: EmployeeCd): Promise<Employee | null>;
}
```

しかし、ユースケースで使う際に毎回nullチェックが必要になり、コードが冗長になる：

```typescript
// ユースケースでの使用例
const employee = await this.employeeRepository.findById(id);
if (!employee) {
  throw new NotFoundError("従業員が見つかりません");
}
// ここでやっと employee を使える
```

## 調査内容

### 選択肢1: null を返す（現在の実装）

**メリット:**
- 「見つからない」は異常ではなく正常な状態として扱える
- 呼び出し側で柔軟に処理を分岐できる
- try-catchが不要で、シンプルなif文で処理

**デメリット:**
- 毎回nullチェックが必要
- nullチェック忘れによるバグのリスク
- TypeScriptの型ガードが必要

**実装例:**
```typescript
const employee = await this.employeeRepository.findById(id);
if (!employee) {
  // 見つからなかった場合の処理
  return null; // または別の処理
}
// employee は Employee 型として扱える
```

### 選択肢2: 例外を投げる

**メリット:**
- 戻り値が常に Entity 型で扱いやすい
- nullチェックが不要
- 「見つからない」を明示的にエラーとして扱う

**デメリット:**
- 正常系で例外を使うことの是非
- try-catchのオーバーヘッド
- 呼び出し側での柔軟性が減る

**実装例:**
```typescript
// リポジトリ
async findById(id: string): Promise<Employee> {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) {
    throw new NotFoundError(`Employee with id ${id} not found`);
  }
  return EmployeeMapper.toDomain(employee);
}

// ユースケース
const employee = await this.employeeRepository.findById(id);
// employee は常に Employee 型
```

### 選択肢3: ハイブリッド（メソッドを分ける）

**find系: null を返す**
```typescript
findById(id: string): Promise<Employee | null>
```

**get系: 例外を投げる**
```typescript
getById(id: string): Promise<Employee>  // 必ず存在する前提
```

**メリット:**
- 用途に応じて使い分けられる
- 意図が明確になる

**デメリット:**
- メソッドが増える
- どちらを使うか判断が必要

## 解決策

（後で追記予定）

## 関連issue

- #1 - https://github.com/chapplehub/estimate-management-system/issues/1
