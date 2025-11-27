# Vitestのvi.fn()を使ったモックの基本パターン

## 概要

vi.fn()を使ったモック関数の作成と、mockResolvedValue/toHaveBeenCalledWithの役割の違いを理解する。

## 詳細

### モック関数の作成と戻り値設定

#### 1. 空のモック関数を作成（beforeEach）

```typescript
mockRepository = {
  save: vi.fn(),
  findById: vi.fn(),  // この時点では undefined を返す
};
```

`vi.fn()` を引数なしで呼ぶと：
- 呼び出されても何もしない、`undefined` を返す関数を作成
- 呼び出し履歴を記録（後で検証可能）

#### 2. テストケースごとに戻り値を設定

```typescript
vi.mocked(mockRepository.findById).mockResolvedValue(existingEmployee);
```

- `vi.mocked()`: TypeScriptに「これはモック関数」と伝える（型の補助）
- `mockResolvedValue()`: 呼ばれたら `Promise.resolve(値)` を返すよう設定

### mockResolvedValue vs toHaveBeenCalledWith

| メソッド | 目的 | タイミング |
|---------|------|-----------|
| `mockResolvedValue(値)` | 戻り値を制御 | テスト実行**前**に設定 |
| `toHaveBeenCalledWith(引数)` | 呼び出し引数を検証 | テスト実行**後**に検証 |

#### 使い分け

- **mockResolvedValue**: テスト対象を動かすための前提条件を作る
- **toHaveBeenCalledWith**: テスト対象が依存先を正しく使ったか確認

### 全体の流れ

```typescript
// 1. 戻り値を設定（前提条件）
vi.mocked(mockRepository.findById).mockResolvedValue(existingEmployee);

// 2. テスト対象を実行
await command.execute();

// 3. 呼び出しを検証
expect(mockRepository.findById).toHaveBeenCalledWith("test-id-001");
```

### vi.fn() のバリエーション

| パターン | 用途 |
|---------|------|
| `vi.fn()` | 呼び出し履歴だけ記録したい（戻り値不要） |
| `vi.fn().mockReturnValue(x)` | 固定値を返したい（同期） |
| `vi.fn().mockResolvedValue(x)` | Promise で値を返したい（非同期） |
| `vi.fn(impl)` | カスタム実装を渡したい |

## ポイント

- モックは「依存先をテストする」ためではなく「テスト対象を isolated（孤立）して動かす」ため
- 依存先の振る舞いをコントロールすることで、テスト対象だけに集中できる
- `mockResolvedValue` は前提条件、`toHaveBeenCalledWith` は結果の検証

## 参考

- [Vitest Mock Functions](https://vitest.dev/api/mock.html)
- 関連ファイル: `src/subdomains/employee/commands/__tests__/UpdateEmployeeCommand.test.ts`
