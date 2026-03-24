# システム設計書

## 1. プロジェクト概要

### 1.1 システム概要
- **種類**: 社内業務アプリケーション
- **想定ユーザー数**: ピーク時100人
- **アクセス範囲**: 社内ユーザーのみ
- **開発目的**: 業務効率化 & アプリ開発・DDD学習

### 1.2 設計方針
- DDDアーキテクチャによる設計
- 型安全性を重視したTypeScript開発
- テスト駆動開発(TDD)の採用
- 段階的なデプロイ戦略

---

## 2. 技術スタック

### 2.1 フロントエンド
| 項目 | 技術 | バージョン | 用途 |
|------|------|-----------|------|
| 言語 | TypeScript | 最新 | 型安全な開発 |
| フレームワーク | React.js | 18+ | UIライブラリ |
| フレームワーク | Next.js | 15+ (App Router) | フルスタックフレームワーク |
| UIコンポーネント | shadcn/ui | 最新 | 再利用可能なコンポーネント |
| スタイリング | Tailwind CSS | 3+ | ユーティリティファーストCSS |
| 状態管理(サーバー) | TanStack Query | 5+ | サーバー状態管理・キャッシュ |
| 状態管理(クライアント) | Zustand | 4+ | クライアント状態管理 |
| フォーム管理 | Conform | 最新 | フォーム状態管理・バリデーション連携 |

### 2.2 バックエンド
| 項目 | 技術 | バージョン | 用途 |
|------|------|-----------|------|
| 言語 | TypeScript | 最新 | 型安全な開発 |
| フレームワーク | Next.js | 15+ (App Router) | API Routes |
| API設計 | REST API | - | HTTPメソッドによるリソース操作 |
| データベース | PostgreSQL | 16+ | リレーショナルデータベース |
| ORM | Prisma | 5+ | 型安全なDB操作 |
| アーキテクチャ | DDD | - | ドメイン駆動設計 |
| 認証 | Auth.js (NextAuth) | 5+ | 認証・セッション管理 |
| バリデーション | Zod | 3+ | スキーマバリデーション |

### 2.3 テスト
| 項目 | 技術 | 用途 |
|------|------|------|
| 単体・統合テスト | Vitest | 高速テストランナー |
| E2Eテスト | Playwright | ブラウザ自動テスト |
| コンポーネントテスト | Testing Library | Reactコンポーネントテスト |

### 2.4 インフラ・デプロイ
| フェーズ | 環境 | 用途 |
|---------|------|------|
| Phase 1 | Vercel | 初期開発・MVP |
| Phase 1 | Vercel Postgres / Supabase | データベース |
| Phase 2 | Docker + クラウド(AWS/GCP) | 本格運用(将来) |
| Phase 2 | Ubuntu + Nginx | Webサーバー(将来) |

---

## 3. アーキテクチャ設計

### 3.1 全体構成図

```
┌─────────────────────────────────────────────────────┐
│                  クライアント層                       │
│  (React + Next.js + TanStack Query + Zustand)       │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS / REST API
                  ↓
┌─────────────────────────────────────────────────────┐
│              プレゼンテーション層                     │
│  - Next.js API Routes (/app/api)                    │
│  - リクエストバリデーション (Zod)                    │
│  - 認証・認可チェック (Auth.js)                      │
│  - レスポンス整形                                    │
└─────────────────┬───────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────┐
│             アプリケーション層                        │
│  - ユースケース (CreateUserUseCase等)               │
│  - ビジネスフローの制御                              │
│  - トランザクション管理                              │
│  - 重複チェック等のアプリケーションロジック          │
└─────────────────┬───────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────┐
│                ドメイン層                            │
│  - エンティティ (User, Department等)                │
│  - 値オブジェクト (Email, EmployeeId等)             │
│  - ドメインサービス                                  │
│  - リポジトリインターフェース                        │
│  - ビジネスルール                                    │
└─────────────────┬───────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────┐
│           インフラストラクチャ層                      │
│  - リポジトリ実装 (PrismaUserRepository等)          │
│  - マッパー (Prismaモデル ↔ ドメインモデル)        │
│  - Prismaクライアント                               │
│  - 外部API連携                                      │
└─────────────────┬───────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────┐
│              データベース層                          │
│  - PostgreSQL                                       │
└─────────────────────────────────────────────────────┘
```

### 3.2 DDDレイヤー詳細

#### プレゼンテーション層の責務
- HTTPリクエストの受付
- 入力値の形式バリデーション (Zod)
- 認証・認可の確認
- ユースケースの呼び出し
- レスポンスの整形・返却

#### アプリケーション層の責務
- ビジネスフローの調整
- 複数ドメインの協調
- トランザクション境界の管理
- 重複チェックなどのアプリケーション固有ロジック

#### ドメイン層の責務
- ビジネスルールの実装
- エンティティの振る舞い
- 不変条件の保証
- ドメイン知識の表現

#### インフラストラクチャ層の責務
- データの永続化
- 外部システムとの連携
- 技術的な実装詳細の隠蔽

---

## 4. ディレクトリ構成

### 4.1 app/ ディレクトリの構成方針

Next.js App Router の規約に加え、以下のルールを採用：

- **`_` プレフィックス**: ルーティング不要のディレクトリ（例：`_components`, `_lib`, `_hooks`）
- **`()` 括弧（Route Groups）**: URLパスに影響しないグループ化（例：`(features)`, `(auth)`）

### 4.2 ディレクトリ構成

```
project-root/
├── src/
│   ├── app/                              # Presentation Layer (Next.js App Router)
│   │   ├── _components/                  # 横断的に使用する共通コンポーネント
│   │   │   └── shadcnui/                # shadcn/ui コンポーネント
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       └── badge.tsx
│   │   │
│   │   ├── _lib/                        # クライアントサイド共通ライブラリ
│   │   │   ├── auth-client.ts           # 認証クライアント
│   │   │   └── utils.ts                 # ユーティリティ関数
│   │   │
│   │   ├── _hooks/                      # 横断的に使用するカスタムフック（今後追加予定）
│   │   │
│   │   ├── api/                         # API ルート
│   │   │   └── auth/[...all]/
│   │   │       └── route.ts             # better-auth ハンドラ
│   │   │
│   │   ├── (features)/                  # 機能別グループ（Route Groups: URLに含まれない）
│   │   │   │
│   │   │   ├── (auth)/                  # 認証関連機能
│   │   │   │   └── signin/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── schema.ts
│   │   │   │       └── signin-form.tsx
│   │   │   │
│   │   │   └── employees/               # 従業員管理機能
│   │   │       ├── page.tsx             # 一覧ページ (/employees)
│   │   │       ├── _lib/
│   │   │       │   └── error-handler.ts # 機能固有のエラーハンドリング
│   │   │       ├── new/
│   │   │       │   ├── page.tsx         # 新規作成ページ (/employees/new)
│   │   │       │   ├── actions.ts       # Server Actions
│   │   │       │   ├── schema.ts        # Zodスキーマ
│   │   │       │   └── EmployeeCreateForm.tsx
│   │   │       └── [employeeCd]/
│   │   │           ├── page.tsx         # 詳細ページ (/employees/:employeeCd)
│   │   │           ├── actions.ts
│   │   │           ├── schema.ts
│   │   │           ├── EmployeeUpdateForm.tsx
│   │   │           └── EmployeeDeleteForm.tsx
│   │   │
│   │   ├── globals.css
│   │   ├── fonts.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── server/                           # バックエンドロジック
│   │   ├── auth.ts                      # better-auth 設定
│   │   ├── prisma.ts                    # Prisma Client singleton
│   │   │
│   │   ├── subdomains/                  # DDDサブドメイン
│   │   │   └── employee/
│   │   │       ├── domain/              # Domain Layer
│   │   │       │   ├── entities/
│   │   │       │   │   └── Employee.ts
│   │   │       │   ├── values/
│   │   │       │   │   ├── EmployeeCd.ts
│   │   │       │   │   └── Password.ts
│   │   │       │   ├── types/
│   │   │       │   │   └── Role.ts
│   │   │       │   ├── repositories/
│   │   │       │   │   └── IEmployeeRepository.ts
│   │   │       │   └── services/
│   │   │       │       ├── EmployeeCdDuplicationCheckDomainService.ts
│   │   │       │       └── MailAddressDuplicationCheckDomainService.ts
│   │   │       │
│   │   │       ├── application/         # Application Layer
│   │   │       │   ├── commands/
│   │   │       │   │   ├── CreateEmployeeCommand.ts
│   │   │       │   │   ├── UpdateEmployeeCommand.ts
│   │   │       │   │   └── DeleteEmployeeCommand.ts
│   │   │       │   └── queries/
│   │   │       │       ├── dto/
│   │   │       │       │   ├── EmployeeDTO.ts
│   │   │       │       │   └── EmployeeSearchCriteria.ts
│   │   │       │       ├── IEmployeeQueryService.ts
│   │   │       │       ├── GetAllEmployeesQuery.ts
│   │   │       │       ├── GetEmployeeByIdQuery.ts
│   │   │       │       └── ...
│   │   │       │
│   │   │       └── infrastructure/      # Infrastructure Layer
│   │   │           ├── prisma/
│   │   │           │   └── PrismaEmployeeRepository.ts
│   │   │           ├── in-memory/
│   │   │           │   └── InMemoryEmployeeRepository.ts
│   │   │           ├── queries/
│   │   │           │   └── PrismaEmployeeQueryService.ts
│   │   │           └── mappers/
│   │   │               └── EmployeeMapper.ts
│   │   │
│   │   └── shared/                      # サーバーサイド共有
│   │       ├── domain/values/
│   │       │   └── MailAddress.ts
│   │       ├── errors/
│   │       │   ├── DomainError.ts
│   │       │   └── ApplicationError.ts
│   │       ├── ValueObject.ts
│   │       └── StringValueObject.ts
│   │
│   └── shared/                          # フロント/バック共通
│       └── types/
│           └── ActionResult.ts
│
├── generated/
│   └── prisma/                          # Prisma Client生成先
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── .env.local                           # 環境変数
├── vitest.config.ts                     # Vitest設定
├── tsconfig.json                        # TypeScript設定（パスエイリアス）
└── package.json
```

### パスエイリアス

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@server/*": ["./src/server/*"],
      "@shared/*": ["./src/shared/*"],
      "@subdomains/*": ["./src/server/subdomains/*"],
      "@generated/*": ["./generated/*"]
    }
  }
}
```

---

## 5. 認証・認可設計

### 5.1 認証方式
- **プロバイダー**: Auth.js (NextAuth)
- **認証方法**: メールアドレス + パスワード
- **セッション管理**: データベースセッション (PostgreSQL)
- **セッション有効期限**: 8時間

### 5.2 セキュリティ機能
- パスワードハッシュ化 (bcrypt)
- アカウントロックアウト (5回失敗で15分ロック)
- パスワードポリシー (8文字以上、英数字含む)
- 最終ログイン日時の記録

### 5.3 権限管理
```typescript
enum Role {
  ADMIN,  // 管理者: 全機能アクセス可能
  USER    // 一般ユーザー: 制限付きアクセス
}
```

### 5.4 認証フロー
```
1. ユーザーがログインフォームに入力
2. Auth.js CredentialsProvider でバリデーション
3. アカウントロック状態確認
4. パスワード検証
5. セッション作成 (DB保存)
6. クッキーにセッショントークン設定
7. 以降のリクエストでセッション検証
```

---

## 6. API設計

### 6.1 REST API設計方針

#### エンドポイント命名規則
- リソース名は複数形
- 小文字 + ハイフン区切り
- 例: `/api/users`, `/api/employee-records`

#### HTTPメソッド使い分け
| メソッド | 用途 | 例 |
|---------|------|-----|
| GET | リソース取得 | `GET /api/users` |
| POST | リソース作成 | `POST /api/users` |
| PUT | リソース更新(全体) | `PUT /api/users/:id` |
| DELETE | リソース削除 | `DELETE /api/users/:id` |

#### ステータスコード
| コード | 意味 | 使用ケース |
|--------|------|-----------|
| 200 | OK | 成功 |
| 201 | Created | 作成成功 |
| 204 | No Content | 削除成功 |
| 400 | Bad Request | バリデーションエラー |
| 401 | Unauthorized | 未認証 |
| 403 | Forbidden | 権限なし |
| 404 | Not Found | リソースなし |
| 500 | Internal Server Error | サーバーエラー |

### 6.2 レスポンス形式

#### 成功時
```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "name": "田中太郎",
    "email": "tanaka@company.com"
  }
}
```

#### エラー時
```json
{
  "success": false,
  "error": {
    "message": "ユーザーが見つかりません",
    "code": "USER_NOT_FOUND"
  }
}
```

#### ページネーション
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### 6.3 主要APIエンドポイント

#### ユーザー管理
```
GET    /api/users              # ユーザー一覧取得
GET    /api/users/:id          # ユーザー詳細取得
POST   /api/users              # ユーザー作成
PUT    /api/users/:id          # ユーザー更新
DELETE /api/users/:id          # ユーザー削除
```

#### 認証
```
POST   /api/auth/login         # ログイン
POST   /api/auth/logout        # ログアウト
POST   /api/auth/password/reset # パスワードリセット
```

### 6.4 認証ミドルウェア

全てのAPIエンドポイントは `withAuth()` で保護:

```typescript
export const GET = withAuth(async (req, ctx, session) => {
  // 認証済み前提で処理
}, { requireAdmin: false })

export const DELETE = withAuth(async (req, ctx, session) => {
  // 管理者のみ実行可能
}, { requireAdmin: true })
```

---

## 7. バリデーション戦略

### 7.1 多層バリデーション

#### レイヤー別責務
```
プレゼンテーション層 (Zod)
  ↓ 入力形式チェック
  ↓ (型、必須、長さ、正規表現等)

アプリケーション層
  ↓ 重複チェック
  ↓ (メールアドレス、社員番号等)

ドメイン層 (エンティティ)
  ↓ ビジネスルールチェック
  ↓ (年齢制限、ドメイン制限等)
```

### 7.2 共通バリデーションルール

```typescript
// 基本
- email: メールアドレス形式
- password: 8文字以上、英数字含む
- requiredString: 必須文字列

// 日本固有
- phoneNumber: 0始まり9-10桁
- postalCode: 7桁数字

// 業務固有
- employeeId: EMP + 6桁数字 (例: EMP000001)
- departmentCode: 英字2桁 + 数字2桁 (例: IT01)
```

### 7.3 フォーム管理

**Conform + Zod**による型安全なフォーム管理:
- サーバーサイドバリデーション
- リアルタイムバリデーション
- エラーメッセージの統一管理

---

## 8. テスト戦略

### 8.1 テストピラミッド

```
      E2E (少数)
      - ログインフロー
      - ユーザー作成フロー

    統合テスト (中程度)
    - ユースケース層
    - 主要ビジネスフロー

  単体テスト (多数)
  - ドメイン層 (全て)
  - エンティティ
  - 値オブジェクト
  - ビジネスルール
```

### 8.2 テストツール

| テスト種別 | ツール | 対象 |
|-----------|--------|------|
| 単体テスト | Vitest | ドメイン層 |
| 統合テスト | Vitest | ユースケース層 |
| APIテスト | Vitest | API Routes |
| E2Eテスト | Playwright | ユーザーフロー |

### 8.3 TDD (テスト駆動開発)

**Red → Green → Refactor サイクル**

```
1. Red: 失敗するテストを書く
2. Green: テストを通す最小限のコードを書く
3. Refactor: コードを改善する
```

ドメイン層を中心にTDDを適用

### 8.4 テストカバレッジ目標

| レイヤー | カバレッジ目標 |
|---------|--------------|
| ドメイン層 | 90%以上 |
| アプリケーション層 | 80%以上 |
| プレゼンテーション層 | 主要パスのみ |

---

## 9. 状態管理設計

### 9.1 サーバー状態 (TanStack Query)

**用途:**
- APIから取得したデータ
- キャッシュ管理
- ローディング・エラー状態

**実装パターン:**
```typescript
// カスタムフック
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAll(),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: userApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

### 9.2 クライアント状態 (Zustand)

**用途:**
- UI状態 (サイドバー開閉、モーダル等)
- ユーザー設定 (テーマ等)
- localStorage連携

**実装パターン:**
```typescript
export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'light',
      toggleSidebar: () => set((state) => ({ 
        sidebarOpen: !state.sidebarOpen 
      })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'ui-storage' }
  )
)
```

---

## 10. デプロイ戦略

### 10.1 Phase 1: Vercel (初期開発)

**環境:**
- ホスティング: Vercel
- データベース: Vercel Postgres or Supabase
- デプロイ: git push で自動デプロイ

**メリット:**
- セットアップが簡単
- 開発に集中できる
- 無料枠で始められる
- プレビュー環境自動生成

### 10.2 Phase 2: Docker + クラウド (将来)

**環境:**
- コンテナ: Docker
- オーケストレーション: Docker Compose or Kubernetes
- クラウド: AWS / GCP
- Webサーバー: Nginx
- OS: Ubuntu

**構成:**
```
Nginx (リバースプロキシ・SSL終端)
  ↓
Next.js App (Docker コンテナ)
  ↓
PostgreSQL (Docker コンテナ or RDS)
```

---

## 11. セキュリティ対策

### 11.1 認証・認可
- セッションベース認証
- パスワードハッシュ化 (bcrypt)
- アカウントロックアウト
- HTTPS強制

### 11.2 入力検証
- サーバーサイドバリデーション必須
- XSS対策 (自動エスケープ)
- SQLインジェクション対策 (Prisma使用)
- CSRF対策 (Next.js標準機能)

### 11.3 HTTPヘッダー
```nginx
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

---

## 12. 開発フロー

### 12.1 ブランチ戦略

```
main (本番)
  ↑
develop (開発)
  ↑
feature/xxx (機能開発)
```

### 12.2 開発サイクル

```
1. feature ブランチ作成
2. TDDでテスト・実装
3. ローカルでテスト実行
4. develop にマージ
5. Vercel プレビュー環境で確認
6. main にマージ → 本番デプロイ
```

### 12.3 コード品質管理

- ESLint (コード規約)
- Prettier (フォーマット)
- TypeScript strict mode
- Pre-commit hooks (Husky)

---

## 13. パフォーマンス最適化

### 13.1 フロントエンド
- Next.js App Router (React Server Components)
- 画像最適化 (next/image)
- コード分割 (dynamic import)
- TanStack Query によるキャッシュ

### 13.2 バックエンド
- データベースインデックス
- N+1問題の回避 (Prisma include)
- ページネーション実装
- セッションのキャッシュ (将来的にRedis検討)

---

## 14. 監視・ログ

### 14.1 Phase 1 (Vercel)
- Vercel Analytics
- Vercel Logs
- エラートラッキング (Sentry検討)

### 14.2 Phase 2 (自前サーバー)
- アプリケーションログ (Winston等)
- アクセスログ (Nginx)
- エラー監視 (Sentry等)
- パフォーマンス監視 (New Relic等)

---

## 15. バックアップ・災害復旧

### 15.1 データベースバックアップ
- 自動バックアップ (毎日深夜実行)
- 保持期間: 7日間
- リストア手順の文書化

### 15.2 災害復旧計画 (DR)
- RTO (目標復旧時間): 4時間
- RPO (目標復旧時点): 24時間
- 定期的なリストアテスト実施

---

## 16. 今後の拡張性

### 16.1 スケーラビリティ
- 水平スケーリング可能な設計
- ステートレスなアプリケーション
- データベースの読み取りレプリカ(将来)

### 16.2 機能拡張
- 多要素認証 (2FA) 追加可能
- SSO連携 (Google Workspace等) 可能
- モバイルアプリ対応可能 (REST API活用)

---

## 付録A: 環境変数一覧

```bash
# データベース
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# 認証
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# 本番環境
NODE_ENV=production
```

---

## 付録B: 主要コマンド

```bash
# 開発サーバー起動
pnpm dev

# ビルド
pnpm build

# 本番サーバー起動
pnpm start

# テスト実行
pnpm test

# テストカバレッジ
pnpm test:coverage

# Prisma マイグレーション
pnpm exec prisma migrate dev

# Prisma Studio起動
pnpm exec prisma studio

# リント
pnpm lint

# フォーマット
pnpm format
```

---

## 変更履歴

| バージョン | 日付 | 変更内容 | 作成者 |
|-----------|------|---------|--------|
| 1.0 | 2025-10-07 | 初版作成 | - |

