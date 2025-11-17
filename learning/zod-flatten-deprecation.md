# Zod v4: flatten() 非推奨と正しい実装方法

## 概要

Zod導入時に、非推奨の `flatten()` メソッドを使用してしまった。このドキュメントでは、その経緯、正しい実装方法、そしてCLAUDE.mdに追加したルールについてまとめる。

## 問題

### 実装したコード（誤り）

```typescript
// web/src/app/employees/new/actions.ts
const validationResult = createEmployeeSchema.safeParse(rawData);
if (!validationResult.success) {
  const errors = validationResult.error.flatten().fieldErrors; // ⚠️ 非推奨
  return {
    success: false,
    errors: errors as Record<string, string[]>,
  };
}
```

### 問題点

- `flatten()` はZod v4で非推奨（deprecated）
- TypeScript警告が出ていた
- 記憶に基づいて実装し、公式ドキュメントを確認しなかった

## 正しい実装（Zod v4）

### 推奨される方法

```typescript
import { z } from "zod";

const validationResult = createEmployeeSchema.safeParse(rawData);
if (!validationResult.success) {
  const { fieldErrors } = z.flattenError(validationResult.error);
  // fieldErrors は既に Record<string, string[]> 型
  return {
    success: false,
    errors: fieldErrors,
  };
}
```

### Zod v4のエラーフォーマットメソッド

| メソッド | 用途 | 戻り値 |
|---------|------|-------|
| `z.flattenError()` | フォームバリデーション（推奨） | `{ formErrors: string[], fieldErrors: Record<string, string[]> }` |
| `z.treeifyError()` | 複雑なネスト構造 | ツリー形式 |
| `z.prettifyError()` | ログやCLI出力 | 人間が読みやすい文字列 |
| ~~`flatten()`~~ | 非推奨 | - |
| ~~`format()`~~ | 非推奨（`treeifyError()`に置き換え） | - |

参考: https://zod.dev/error-formatting

## なぜこの問題が発生したのか

### 原因分析

1. **CLAUDE.mdのルールが適用されなかった場面**
   - 「実装前の確認プロセス」は大きな設計判断を想定
   - 個別のAPI使用時の確認プロセスが不明確だった

2. **記憶・推測に頼ってしまった**
   - 「Zodのエラーハンドリングは flatten() を使う」という記憶に基づいて実装
   - package.jsonでZod v4を確認しなかった
   - WebFetchで公式ドキュメントを確認しなかった

3. **「記憶・推測の禁止」の範囲が狭かった**
   - 当初は「URL構築」に限定されていた
   - APIの使い方についての記憶・推測は明示的に禁止されていなかった

## CLAUDE.mdへの追加ルール

この問題を受けて、以下のルールをCLAUDE.mdに追加した：

### 1. 「実装前の確認プロセス」の拡張

```markdown
新しい機能や問題解決の実装を提案する前に、**および個別のAPI・メソッドを使用する前に**、必ず以下を確認する：
```

→ 大きな設計判断だけでなく、**個別のAPI使用時も確認プロセスを適用**

### 2. 「記憶・推測の禁止」の拡張

```markdown
誤った手順（やってはいけない）：
- ❌ 記憶や推測でURLを構築する
- ❌ 記憶や推測でAPI・メソッドの使い方を実装する  ← 追加
```

→ URL構築だけでなく、**API実装も記憶に頼らない**

### 3. 新セクション「APIレベルの実装ルール」

以下の内容を追加：

- **使用前に必ずドキュメント確認**
  - 新しいライブラリ、メジャーバージョンアップ、非推奨警告がある場合は必須
- **確認の手順**
  - package.json → WebFetch → 実装
- **実装例**（悪い例・良い例）

## 修正内容

### 修正したファイル

1. `web/src/app/employees/new/actions.ts`
   - `z` をimport追加
   - `flatten()` → `z.flattenError()` に変更

2. `web/src/app/employees/[employeeCd]/actions.ts`
   - 同様に修正

3. `CLAUDE.md`
   - 3箇所修正（上記参照）

## 教訓

### 今後の実装時に意識すること

1. **ライブラリのAPIを使う前に**
   - package.jsonでバージョン確認
   - 公式ドキュメントで推奨方法を確認
   - メジャーバージョンが上がっている場合は特に注意

2. **非推奨警告は無視しない**
   - TypeScript警告が出たら、その場で調査・修正

3. **記憶に頼らない**
   - 「以前こうだった」という記憶ではなく、**現在の公式ドキュメント**を確認

## 関連リソース

- Zod v4 Error Formatting: https://zod.dev/error-formatting
- Zod v4 Changelog (flatten非推奨): https://zod.dev/v4/changelog?id=deprecates-flatten
- CLAUDE.md: `/home/chapple/dev/estimate-management-system/CLAUDE.md`
