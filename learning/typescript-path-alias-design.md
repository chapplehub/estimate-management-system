# TypeScriptパスエイリアス設計の一貫性

## 概要

モノレポ構成でsrc/、lib/、generated/が同階層にある場合のTypeScriptパスエイリアス設計について。
tsconfig.jsonとvitest.config.tsでパス解決の一貫性を保つための設計思想と実装方法。

## 問題の発見

### 当初の設定（問題あり）

```json
// tsconfig.json
{
  "paths": {
    "@/*": ["./src/*"],
    "@/lib/*": ["./lib/*"],           // ⚠️ 同じ@/プレフィックス
    "@/generated/*": ["./generated/*"] // ⚠️ 同じ@/プレフィックス
  }
}
```

```typescript
// vitest.config.ts
alias: {
  "@/lib": path.resolve(__dirname, "./lib"),
  "@/generated": path.resolve(__dirname, "./generated"),
  "@": path.resolve(__dirname, "./src"),
}
```

### 何が問題だったか

1. **同じプレフィックスが複数のベースディレクトリを指す**
   - `@/domain/...` → `src/domain/...`
   - `@/lib/prisma` → `lib/prisma`
   - 同じ`@/`プレフィックスなのに、状況によって異なる場所にマップされる

2. **コードを読むまで場所がわからない**
   ```typescript
   import { xxx } from "@/lib/prisma"  // これはsrc配下？lib配下？
   ```

3. **TypeScriptの優先順位に依存**
   - より具体的なパターン（`@/lib/*`）が優先される仕様に依存している
   - 設定を見ないと挙動が理解できない

## 解決策の検討

### 選択肢1: @/*をwebルート全体にマッピング

```json
"paths": {
  "@/*": ["./*"]
}
```

- すべて`@/src/...`, `@/lib/...`, `@/generated/...`と書く
- 最も一貫性があるが、`@/src/`を毎回書く冗長さがある

### 選択肢2: 別プレフィックスを使う ⭐️（採用）

```json
"paths": {
  "@/*": ["./src/*"],
  "@lib/*": ["./lib/*"],
  "@generated/*": ["./generated/*"]
}
```

- メインコードは`@/domain/...`（短い）
- libは`@lib/prisma`、generatedは`@generated/prisma`
- プレフィックスで役割が明確

### 選択肢3: lib/とgenerated/をsrc配下に移動

```
src/
├── app/
├── domain/
├── lib/        ← 移動
└── generated/  ← 移動
```

- すべてsrc配下に統一
- pathsが1つだけで最もシンプル
- ただし構造変更が必要

## 採用した解決策：別プレフィックス方式

### @/lib/* vs @lib/* の違い

**@/lib/*（スラッシュあり）**
- `@/`というプレフィックスの一部として`lib`を扱う
- `@/`が状況によって異なる場所を指す
- TypeScriptの優先順位に依存

**@lib/*（スラッシュなし）**
- 完全に独立したプレフィックス
- インポート文を見ただけで場所が明確
- プレフィックスの独立性が保たれる

### 設計思想

```
web/                          ← プロジェクトルート（package.jsonがある場所）
├── src/                      ← メインソースコード（@/ が指す）
│   ├── app/
│   ├── domain/
│   └── shared/
├── lib/                      ← ユーティリティ・外部ツール（@lib/ が指す）
│   └── prisma.ts
├── generated/                ← 自動生成ファイル（@generated/ が指す）
│   └── prisma/
└── prisma/                   ← 設定ファイル（インポートしない）
    └── schema.prisma
```

**各プレフィックスの役割：**

1. **@/** → メインのアプリケーションコード
   - ビジネスロジック、UI、ドメインモデルなど
   - 開発者が日常的に書く・編集するコード
   - 「このプロジェクトの本体」

2. **@lib/** → インフラ的なユーティリティ
   - Prismaクライアントのシングルトン、設定など
   - アプリケーションから使われるが、ビジネスロジックではない
   - 「外部ツールとの接続層」

3. **@generated/** → 外部ツールが生成したコード
   - Prisma Clientなど
   - 手で編集しない
   - 「自動生成物」

### Next.jsの一般的な慣習との整合性

Next.jsプロジェクトでは`@/* → ./src/*`がデファクトスタンダード。

lib/の扱いには2つの流派がある：

**A派: lib/もsrc配下に置く（単純）**
```
src/
├── app/
├── domain/
└── lib/        ← src配下
```
→ `@/lib/prisma`で統一

**B派: lib/はsrc外に置く（分離）**
```
src/          ← アプリコード
lib/          ← インフラ
```
→ `@lib/prisma`で分ける

このプロジェクトはB派の構造なので、`@lib/*`が思想的に合っている。

## 実装

### 1. tsconfig.json の修正

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@lib/*": ["./lib/*"],           // 独立したプレフィックス
      "@generated/*": ["./generated/*"] // 独立したプレフィックス
    }
  }
}
```

### 2. vitest.config.ts の修正

```typescript
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "./lib"),        // スラッシュなし
      "@generated": path.resolve(__dirname, "./generated"), // スラッシュなし
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**順番の注意点：**
- Viteのaliasは定義順に評価される
- より具体的なもの（`@lib`, `@generated`）を先に書く
- `@`は最後に書いて、他にマッチしなかったものだけキャッチする

### 3. 既存のインポート文の修正

修正が必要だった3ファイル：

```typescript
// PrismaEmployeeRepository.ts
- import prisma from "@/lib/prisma";
+ import prisma from "@lib/prisma";

// PrismaEmployeeRepository.test.ts
- import prisma from "@/lib/prisma";
+ import prisma from "@lib/prisma";

// EmployeeMapper.ts
- import { Employee as PrismaEmployee } from "@/generated/prisma/client";
+ import { Employee as PrismaEmployee } from "@generated/prisma/client";
```

## 使用例

### 修正前（一貫性なし）

```typescript
import { Employee } from "@/domain/entities/Employee"  // → src/domain/...
import { prisma } from "@/lib/prisma"                  // → lib/prisma
// ⚠️ 同じ@/なのに違う場所を指している
```

### 修正後（一貫性あり）

```typescript
import { Employee } from "@/domain/entities/Employee"  // → src/domain/...
import { prisma } from "@lib/prisma"                   // → lib/prisma
// ✅ 別プレフィックスで場所が明確
```

## 検証

### TypeScript型チェック

```bash
npx tsc --noEmit
# → エラーなし ✅
```

### Vitestでのパス解決

```bash
npm test
# → 102テスト成功（ドメイン層のテストなど）✅
# → パスエイリアスが正常に機能している証拠
```

特に以下のテストが成功していることで、パス解決が正常に動作していることを確認：
- `MailAddress.test.ts`
- `EmployeeCd.test.ts`
- `Employee.test.ts`
- `InMemoryEmployeeRepository.test.ts`

## 重要なポイント

### tsconfig.jsonとvitest.config.tsの一致は必須

- **IDEの型チェック**: tsconfig.jsonのpathsを使用
- **テスト実行時**: vitest.config.tsのaliasを使用

両者が不一致だと、IDEでは正常に見えてもテストが失敗する、または逆のケースが発生する。

### キャッシュクリアが必要な場合

paths設定を変更した後は、以下のキャッシュをクリアする：

```bash
rm -rf .next node_modules/.vite tsconfig.tsbuildinfo
npm test
```

詳細は `learning/vitest-cache-error.md` を参照。

## まとめ

### 設計原則

1. **プレフィックスは役割を表す**
   - `@/` = メインのアプリケーションコード
   - `@lib/` = インフラ・ユーティリティ
   - `@generated/` = 自動生成ファイル

2. **一貫性を保つ**
   - 同じプレフィックスが複数の場所を指さない
   - tsconfig.jsonとvitest.config.tsで完全一致させる

3. **可読性を優先**
   - インポート文を見ただけで場所がわかる
   - TypeScriptの優先順位ルールに依存しない

### ベストプラクティス

- src/配下のメインコードは`@/`で統一
- src/外の特殊ディレクトリは独立したプレフィックス（`@lib/`, `@generated/`）を使う
- プレフィックスにスラッシュを含めない（`@lib`であって`@/lib`ではない）
- 設定変更後はキャッシュをクリアしてテストする

## 参考

- 関連ファイル:
  - `web/tsconfig.json`
  - `web/vitest.config.ts`
  - 修正したインポート: `PrismaEmployeeRepository.ts`, `PrismaEmployeeRepository.test.ts`, `EmployeeMapper.ts`
- 関連ドキュメント:
  - `learning/vitest-cache-error.md`
  - `CLAUDE.md` - "Path alias @/* maps to ./src/*"
- 実施日: 2025-11-03
