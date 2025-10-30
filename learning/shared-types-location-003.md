# フルスタック構成における型定義の配置場所（domain/types vs src/types）

## 疑問・問題

Next.jsフルスタック構成のプロジェクトにおいて、フロントエンドとバックエンドの両方で使用する型定義（`Role`等）をどこに配置すべきか？

**主な選択肢：**
1. `domain/types/` - Domain層が所有（DDD重視）
2. `src/types/` - プロジェクト全体で共有（実用性重視）
3. `shared/types/` - shared扱い

## 背景・コンテキスト

### プロジェクト構成

このプロジェクトは**Next.jsフルスタック構成**（フロントエンド + バックエンドのモノレポ）：

```
web/src/
├── app/
│   ├── (routes)/          # 【Frontend】 UI pages, components
│   ├── api/               # 【Backend】 API Routes (future)
│   └── actions/           # 【Backend】 Server Actions (future)
├── domain/                # 【Backend】 DDD Domain層
├── application/           # 【Backend】 DDD Application層
├── infrastructure/        # 【Backend】 DDD Infrastructure層
└── shared/                # 【共通】 両方で使えるutility
    ├── errors/
    └── utils/
```

CLAUDE.mdにも明記されている通り、`shared/`は「フロントエンドとバックエンドの両方で使える」ユーティリティを配置する場所。

### 具体的な使用シーン

**Role型を例にすると：**

**フロントエンド（UI）での使用：**
```tsx
// app/(routes)/employees/page.tsx
import { Role } from '???'  // どこからimportすべき？

// 管理者だけにボタン表示
{user.role === Role.ADMIN && <AdminButton />}

// フォームのselect options
<select>
  <option value={Role.ADMIN}>管理者</option>
  <option value={Role.USER}>一般ユーザー</option>
</select>
```

**バックエンド（Domain層）での使用：**
```typescript
// domain/entities/Employee.ts
import { Role } from '???'  // どこからimportすべき？

export class Employee {
  constructor(private _role: Role) {}

  isAdmin(): boolean {
    return this._role === Role.ADMIN
  }
}
```

**結論：Roleは明らかにフロントエンドとバックエンドの両方で使う。**

### 問題の発端

issue #2 で`enum` vs `as const`を議論した際、`domain/types/`に配置することを検討していたが、フルスタック構成であることを考慮すると、`src/types/`に配置した方が自然ではないかという疑問が浮上。

## 調査内容

### 選択肢の比較

#### パターンA: `src/types/` に配置（共通型として扱う）

```
src/
├── types/
│   ├── Role.ts           ← 全体で共有
│   └── (future) OrderStatus.ts
├── domain/
│   └── entities/
│       └── Employee.ts   ← import { Role } from '@/types/Role'
└── app/
    └── (routes)/
        └── page.tsx      ← import { Role } from '@/types/Role'
```

**メリット:**
- ✅ 明示的に「共通型」として扱える
- ✅ フロントエンドが`domain/`をimportする違和感がない
- ✅ Next.jsプロジェクトの一般的なパターン（実務でよく見る）
- ✅ 実用性が高い
- ✅ すべての層から同じパスでimport（`@/types/Role`）
- ✅ 「型定義はプロジェクトルートに置く」という直感的な分かりやすさ

**デメリット:**
- ❌ DDDの原則「Domain層がビジネス概念を所有する」に反する
- ❌ Domain層が`src/types/`に依存することになる（依存の方向が逆？）
- ❌ 「型」という技術的な分類であり、DDD的には概念的な分類が望ましい
- ❌ Roleは明確に「ドメイン概念」なのに、domain層の外に置くことになる

---

#### パターンB: `domain/types/` に配置（Domain層が所有）

```
src/
├── domain/
│   ├── types/
│   │   └── Role.ts       ← Domain層がowner
│   └── entities/
│       └── Employee.ts   ← import { Role } from '../types/Role'
└── app/
    └── (routes)/
        └── page.tsx      ← import { Role } from '@/domain/types/Role'
```

**メリット:**
- ✅ DDDの原則に忠実（Domain層がビジネス概念を所有）
- ✅ 依存の方向が正しい（Presentation → Domain）
- ✅ Roleは「ドメイン概念」であることが明確
- ✅ ビジネスルールに関わる型はDomain層に集約される
- ✅ DDDの「ユビキタス言語」の概念に沿う（ドメインの言葉はDomain層が定義）

**デメリット:**
- ⚠️ フロントエンドが`domain/`をimportする（でも依存方向は正しい）
- ⚠️ Next.jsプロジェクトとしては若干珍しいパターン
- ⚠️ 「domain」という名前がバックエンド専用に見える可能性

---

#### パターンC: `shared/types/` に配置（shared扱い）

```
src/
├── shared/
│   ├── errors/
│   ├── utils/
│   └── types/
│       └── Role.ts       ← shared扱い
├── domain/
│   └── entities/
│       └── Employee.ts   ← import { Role } from '@/shared/types/Role'
└── app/
    └── (routes)/
        └── page.tsx      ← import { Role } from '@/shared/types/Role'
```

**メリット:**
- ✅ 既存の`shared/`ディレクトリを活用（新規ディレクトリ不要）
- ✅ CLAUDE.mdの方針に沿う（sharedは両方で使える）
- ✅ 「共有されるもの」という意味が明確

**デメリット:**
- ❌ Roleは「ドメイン概念」なのに`shared`は違和感がある
- ❌ `shared`は技術的なutility（errors, utils）のイメージが強い
- ❌ ビジネス概念と技術的ユーティリティが混在する
- ❌ sharedの責務が曖昧になる（「何でもshared」になるリスク）

---

### 依存方向の分析

#### パターンA (`src/types/`)の場合：
```
Presentation層 → src/types/Role
Domain層       → src/types/Role
```
- Domain層が外部（`src/types/`）に依存
- DDD的には「Domain層は独立すべき」という原則に反する

#### パターンB (`domain/types/`)の場合：
```
Presentation層 → domain/types/Role
Domain層       → domain/types/Role (内部)
```
- Presentation層がDomain層に依存（正しい方向）
- Domain層は自身の型を所有（独立性が保たれる）

#### パターンC (`shared/types/`)の場合：
```
Presentation層 → shared/types/Role
Domain層       → shared/types/Role
```
- 両方が`shared`に依存
- 中立的だが、Roleの「所有者」が曖昧

---

### プロジェクトの性質を考慮

1. **学習用DDDプロジェクト** → DDDの原則を学ぶことが主目的
2. **Next.jsフルスタック** → 実用的なパターンも学びたい
3. **小規模（内部ツール、100ユーザー）** → 過度に厳格にする必要はない

### 実務での一般的なパターン

- **大規模Next.jsプロジェクト**: `src/types/`や`types/`が一般的
- **DDD重視のプロジェクト**: Domain層が型を所有
- **モノレポ**: パッケージ間で共有する型は専用パッケージ（`@myapp/types`）を作ることもある

## 解決策

### 暫定的な決定（2025-10-30）

**型定義は `src/domain/types/` に配置する**

**理由：**
- フロントエンド開発がまだ本格化していない
- ドメイン概念・API型・UI専用型の使用パターンが見えていない
- 実際のニーズが明確になってから再検討する方が賢明

**保留事項：**
- UI専用型の扱い（`src/types/`を新設するか）
- API型（DTO）の配置
- ドメイン型との重複度合い

**再検討タイミング：**
フロントエンド開発が本格化し、以下が明確になったとき：
- UI専用型がどれくらい必要か
- API型（DTO）とドメイン型の重複度合い
- `src/types/`を新設する必要性

### トレードオフ

この決定により：
- ✅ DDD原則に従う（Domain層がビジネス概念を所有）
- ✅ 過度な先回り設計を避ける
- ⚠️ 将来的にリファクタリングが必要になる可能性（ただし、その時点で判断材料が揃う）

## 関連issue

- #3
- #2 (enum vs as const の議論から派生)
