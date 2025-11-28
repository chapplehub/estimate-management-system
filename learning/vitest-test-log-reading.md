# Vitest のテストログの読み解き方

## 概要

Vitest でテスト実行時に出力されるログ（特にテスト失敗時のエラーメッセージ）の読み方について。

## 詳細

### テスト結果の全体構造

```
 ❯ src/path/to/test.ts (4 tests | 1 failed) 13ms
   ❯ テストスイート名 (4)
     ✓ 成功したテスト 5ms
     ✓ 成功したテスト 1ms
     × 失敗したテスト 6ms   ← ❌ 失敗
```

| 記号 | 意味 |
|------|------|
| `✓` | テスト成功 |
| `×` | テスト失敗 |
| `❯` | テストファイルまたはテストスイート（describe） |

### 失敗時のエラーメッセージ構造

```
FAIL  src/path/to/test.ts > テストスイート名 > テスト名
AssertionError: promise resolved "undefined" instead of rejecting

- Expected:
Error {
  "message": "rejected promise",
}

+ Received:
undefined

 ❯ src/path/to/test.ts:105:5
    103|         role: Role.USER,
    104|       })
    105|     ).rejects.toThrow(ValidationError);
       |     ^
```

### 各部分の意味

#### 1. テストの場所
```
FAIL  src/path/to/test.ts > テストスイート名 > テスト名
```
どのファイルの、どの describe の、どのテストが失敗したか。

#### 2. エラーの種類と理由
```
AssertionError: promise resolved "undefined" instead of rejecting
```

| 部分 | 意味 |
|------|------|
| `AssertionError` | アサーション（期待値チェック）が失敗した |
| メッセージ本文 | 何が起きたかの説明 |

よくあるメッセージ：
- `promise resolved "..." instead of rejecting` - reject を期待したが resolve した
- `expected X to equal Y` - 値が一致しなかった
- `expected X to be Y` - 型や参照が一致しなかった

#### 3. Expected vs Received
```
- Expected:     ← 期待していたもの（テストコードが求めていた値）
...

+ Received:     ← 実際に受け取ったもの（実際のコードが返した値）
...
```

- `-` (マイナス、赤) = Expected（期待値）
- `+` (プラス、緑) = Received（実際の値）

#### 4. エラー発生箇所
```
 ❯ src/path/to/test.ts:105:5
    103|         role: Role.USER,
    104|       })
    105|     ).rejects.toThrow(ValidationError);
       |     ^
```

- `105:5` = 105行目、5文字目
- `^` = エラーが発生した正確な位置

#### 5. サマリー
```
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
   Duration  149ms
```

- 失敗/成功したファイル数とテスト数
- 実行時間

### rejects 関連のエラーメッセージ

| メッセージ | 意味 |
|-----------|------|
| `promise resolved "undefined" instead of rejecting` | reject を期待したが、resolve して undefined を返した |
| `promise resolved "値" instead of rejecting` | reject を期待したが、resolve して値を返した |
| `Received promise rejected with...` | reject されたが、期待したエラーと違った |

## 参考

- [Reporters | Guide | Vitest](https://vitest.dev/guide/reporters) - レポーター設定
- [Command Line Interface | Guide | Vitest](https://vitest.dev/guide/cli) - CLI オプション
- Vitest のエラーメッセージ形式は Jest 由来の慣習的なフォーマット（`@vitest/expect` パッケージで実装）
