# Vitest の `rejects` マッチャーの動作

## 概要

非同期関数（Promise を返す関数）が reject することをテストする際に使用する `rejects` マッチャーの動作について。

## 詳細

### 同期エラー vs 非同期エラー

```typescript
// 同期関数の場合 - toThrow が直接使える
expect(() => {
  throw new Error("sync error");
}).toThrow(Error);

// 非同期関数の場合 - rejects が必要
await expect(asyncFunction()).rejects.toThrow(Error);
```

### なぜ `rejects` が必要か

```typescript
// ❌ これは動かない
expect(command.execute({ ... })).toThrow(ValidationError);
```

この場合、`command.execute()` は **Promise を返す**ので：
1. `expect()` は Promise オブジェクト自体を受け取る
2. Promise オブジェクトは「投げられた例外」ではない
3. `toThrow` は「関数が同期的に例外を投げたか」をチェックする

### `rejects` の動作フロー

```typescript
await expect(promise).rejects.toThrow(ValidationError);
```

1. `rejects` は Promise が **reject されるのを待つ**
2. reject された値（エラー）を取り出す
3. そのエラーに対して `toThrow` マッチャーを適用

```
Promise (pending)
    ↓ await + rejects
Promise が reject → Error を取り出す
    ↓ toThrow
Error が ValidationError かチェック
```

### Promise が reject されなかった場合

**テストが失敗する**。

```typescript
it("rejectされなかった場合", async () => {
  await expect(
    Promise.resolve("成功しました") // reject ではなく resolve
  ).rejects.toThrow(ValidationError);
});
```

結果：
```
AssertionError: promise resolved "成功しました" instead of rejecting
```

### `rejects` の期待する動作まとめ

| Promise の結果 | テスト結果 |
|---------------|-----------|
| reject される | `toThrow` のマッチャーで検証 → 一致すれば成功 |
| resolve される | **即座に失敗**（「reject を期待したのに resolve した」） |

`rejects` は「この Promise は reject されるはず」という**アサーション自体**も含んでいる。

### `await` も必須

```typescript
// ❌ await がないとテストが終わる前に次に進む
expect(command.execute()).rejects.toThrow();

// ✅ await で reject を待つ
await expect(command.execute()).rejects.toThrow();
```

`await` がないと、テストフレームワークは Promise の reject を待たずに「テスト成功」と判定してしまう可能性がある。

### 比較表

| パターン | 対象 | 使い方 |
|---------|------|--------|
| `.toThrow()` | 同期関数 | `expect(() => fn()).toThrow()` |
| `.rejects.toThrow()` | Promise (async) | `await expect(asyncFn()).rejects.toThrow()` |
| `.resolves.toBe()` | Promise (成功) | `await expect(asyncFn()).resolves.toBe(value)` |

## 参考

- [Vitest - expect.rejects](https://vitest.dev/api/expect.html#rejects)
- `src/subdomains/employee/commands/__tests__/CreateEmployeeCommand.test.ts`
