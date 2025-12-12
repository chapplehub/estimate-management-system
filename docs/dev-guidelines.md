# 開発ガイドライン

## 目次

1. [コーディング規約](#1-コーディング規約)
2. [命名規則](#2-命名規則)
3. [エラーハンドリング](#3-エラーハンドリング)
4. [TypeScript 使用規則](#4-typescript使用規則)
5. [DDD アーキテクチャ実装規則](#5-dddアーキテクチャ実装規則)
   - [5.6 認証・認可実装規則](#56-認証認可実装規則)
6. [コメント規則](#6-コメント規則)
7. [テストコード規則](#7-テストコード規則)

---

## 1. コーディング規約

### 1.1 基本原則

#### コードスタイル

- **インデント**: スペース 2 個
- **セミコロン**: 必須
- **クォート**: シングルクォート (`'`) を使用
- **末尾カンマ**: 複数行の場合は必須
- **行の長さ**: 最大 100 文字（ESLint で自動チェック）

```typescript
// ✅ Good
const user = {
  name: "John",
  email: "john@example.com",
};

// ❌ Bad
const user = {
  name: "John",
  email: "john@example.com",
};
```

#### ファイル構成

```typescript
// 1. 外部ライブラリのインポート
import { useState } from "react";
import { z } from "zod";

// 2. 内部モジュールのインポート（aliasを使用）
import { User } from "@/domain/entities/User";
import { UserRepository } from "@/infrastructure/repositories/PrismaUserRepository";

// 3. 型定義
type UserFormData = {
  name: string;
  email: string;
};

// 4. 定数
const MAX_NAME_LENGTH = 50;

// 5. メインコード
export class CreateUserUseCase {
  // ...
}
```

### 1.2 関数・メソッド規則

#### 関数の長さ

- 1 関数は最大 50 行まで
- 責務が明確で単一機能に絞る
- 50 行を超える場合は分割を検討

```typescript
// ✅ Good - 責務が明確で短い
async function validateUser(data: UserInput): Promise<ValidationResult> {
  const emailValidation = validateEmail(data.email);
  const passwordValidation = validatePassword(data.password);

  return {
    isValid: emailValidation.isValid && passwordValidation.isValid,
    errors: [...emailValidation.errors, ...passwordValidation.errors],
  };
}

// ❌ Bad - 複数の責務が混在
async function createUserAndSendEmail(data: UserInput) {
  // ユーザー作成処理（30行）
  // メール送信処理（20行）
  // ログ記録処理（15行）
  // → 分割すべき
}
```

#### アロー関数 vs 通常関数

```typescript
// ✅ コールバック、短い関数 → アロー関数
const users = data.map((user) => user.name);
const doubled = numbers.map((n) => n * 2);

// ✅ クラスメソッド、複雑なロジック → 通常関数
class UserService {
  async createUser(data: CreateUserInput): Promise<User> {
    // 複雑な処理
  }
}

// ✅ ユースケース → 通常関数（thisが不要でも可読性重視）
export async function executeCreateUser(input: CreateUserInput): Promise<User> {
  // ...
}
```

#### 早期リターン

```typescript
// ✅ Good - 早期リターンで階層を浅く
function processUser(user: User | null): string {
  if (!user) return "User not found";
  if (!user.isActive) return "User is inactive";
  if (!user.email) return "Email required";

  return `Welcome ${user.name}`;
}

// ❌ Bad - ネストが深い
function processUser(user: User | null): string {
  if (user) {
    if (user.isActive) {
      if (user.email) {
        return `Welcome ${user.name}`;
      } else {
        return "Email required";
      }
    } else {
      return "User is inactive";
    }
  } else {
    return "User not found";
  }
}
```

### 1.3 コード構造

#### DRY 原則（Don't Repeat Yourself）

```typescript
// ✅ Good - 共通処理を関数化
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function registerUser(email: string) {
  if (!validateEmail(email)) throw new Error("Invalid email");
  // ...
}

function updateUserEmail(email: string) {
  if (!validateEmail(email)) throw new Error("Invalid email");
  // ...
}

// ❌ Bad - 同じロジックを繰り返し
function registerUser(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email");
  }
}

function updateUserEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email");
  }
}
```

#### SOLID 原則の適用

**単一責任の原則（SRP）**

```typescript
// ✅ Good - 各クラスが単一の責務
class UserValidator {
  validate(user: User): ValidationResult {
    // バリデーションのみ
  }
}

class UserRepository {
  save(user: User): Promise<void> {
    // 永続化のみ
  }
}

// ❌ Bad - 複数の責務
class UserManager {
  validate(user: User) {
    /* ... */
  }
  save(user: User) {
    /* ... */
  }
  sendEmail(user: User) {
    /* ... */
  }
  generateReport(user: User) {
    /* ... */
  }
}
```

---

## 2. 命名規則

### 2.1 基本命名規則

| 種類             | 規則                                                                    | 例                          |
| ---------------- | ----------------------------------------------------------------------- | --------------------------- |
| ファイル         | PascalCase（クラス/コンポーネント）<br>camelCase（関数/ユーティリティ） | `User.ts`<br>`userUtils.ts` |
| クラス           | PascalCase                                                              | `CreateUserUseCase`         |
| インターフェース | PascalCase（I 接頭辞）                                                  | `IUserRepository`           |
| 型エイリアス     | PascalCase                                                              | `UserFormData`              |
| 変数・関数       | camelCase                                                               | `userName`, `getUser()`     |
| 定数             | UPPER_SNAKE_CASE                                                        | `MAX_LOGIN_ATTEMPTS`        |
| Private 変数     | \_接頭辞 + camelCase                                                    | `_userId`                   |
| React Component  | PascalCase                                                              | `UserList.tsx`              |
| カスタムフック   | use 接頭辞 + camelCase                                                  | `useUsers.ts`               |

### 2.2 レイヤー別命名規則

#### ドメイン層

```typescript
// エンティティ: 名詞（単数形）
export class User {
  private readonly _id: string;
  private _name: string;
  private _email: Email; // 値オブジェクト
}

// 値オブジェクト: 名詞
export class Email {
  private readonly _value: string;

  constructor(value: string) {
    if (!this.isValid(value)) {
      throw new InvalidEmailError(value);
    }
    this._value = value;
  }
}

// リポジトリインターフェース: I接頭辞 + エンティティ名 + Repository
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

// ドメインサービス: 動詞 + Service
export class UserDuplicationCheckService {
  async isDuplicated(email: Email): Promise<boolean> {
    // ...
  }
}
```

#### アプリケーション層

```typescript
// ユースケース: 動詞 + 名詞 + UseCase
export class CreateUserUseCase {
  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    // ...
  }
}

export class GetUsersUseCase {
  async execute(input: GetUsersInput): Promise<GetUsersOutput> {
    // ...
  }
}

// 入出力DTO: ユースケース名 + Input/Output
export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
};

export type CreateUserOutput = {
  id: string;
  name: string;
  email: string;
};
```

#### インフラストラクチャ層

```typescript
// リポジトリ実装: 技術名 + エンティティ名 + Repository
export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    // ...
  }
}

// マッパー: エンティティ名 + Mapper
export class UserMapper {
  static toDomain(prismaUser: PrismaUser): User {
    // ...
  }

  static toPrisma(user: User): PrismaUser {
    // ...
  }
}
```

#### プレゼンテーション層

```typescript
// API Route: HTTPメソッド大文字
// src/app/api/users/route.ts
export async function GET(request: Request) {}
export async function POST(request: Request) {}

// src/app/api/users/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {}

// React Component: PascalCase
export function UserList() {}
export function UserForm() {}

// カスタムフック: use接頭辞
export function useUsers() {}
export function useCreateUser() {}
```

### 2.3 変数・関数命名のベストプラクティス

#### Boolean 変数

```typescript
// ✅ Good - is/has/can/should接頭辞
const isActive = true;
const hasPermission = false;
const canEdit = true;
const shouldValidate = false;

// ❌ Bad
const active = true;
const permission = false;
```

#### 配列・リスト

```typescript
// ✅ Good - 複数形
const users = [...];
const activeUsers = [...];
const userIds = [...];

// ❌ Bad
const userList = [...];
const userArray = [...];
```

#### 関数名

```typescript
// ✅ Good - 動詞で始まる
async function getUser(id: string) {}
async function createUser(data: UserInput) {}
async function validateEmail(email: string) {}
async function isUserActive(userId: string) {}

// ❌ Bad - 名詞のみ
async function user(id: string) {}
async function email(email: string) {}
```

#### 一時変数・ループ変数

```typescript
// ✅ Good - 意味のある名前
for (const user of users) {
  console.log(user.name);
}

users.forEach((user, index) => {
  console.log(`${index}: ${user.name}`);
});

// ⚠️ 許容 - 短いループのみ
for (let i = 0; i < 10; i++) {
  // ...
}

// ❌ Bad - 意味不明な略語
for (const u of users) {
  console.log(u.n);
}
```

---

## 3. エラーハンドリング

### 3.1 エラー階層設計

```typescript
// 基底エラークラス
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ドメインエラー（400系）
export class DomainError extends AppError {
  readonly statusCode = 400;
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// ビジネスルール違反
export class BusinessRuleViolationError extends DomainError {
  constructor(message: string) {
    super("BUSINESS_RULE_VIOLATION", message);
  }
}

// バリデーションエラー
export class ValidationError extends DomainError {
  readonly errors: ValidationErrorDetail[];

  constructor(errors: ValidationErrorDetail[]) {
    super("VALIDATION_ERROR", "Validation failed");
    this.errors = errors;
  }
}

type ValidationErrorDetail = {
  field: string;
  message: string;
};

// リソースが見つからない（404）
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";

  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
  }
}

// 認証エラー（401）
export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = "UNAUTHORIZED";

  constructor(message = "Unauthorized") {
    super(message);
  }
}

// 権限エラー（403）
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = "FORBIDDEN";

  constructor(message = "Forbidden") {
    super(message);
  }
}

// インフラエラー（500系）
export class InfrastructureError extends AppError {
  readonly statusCode = 500;
  readonly code = "INFRASTRUCTURE_ERROR";

  constructor(message: string, public readonly originalError?: Error) {
    super(message);
  }
}
```

### 3.2 レイヤー別エラーハンドリング

#### ドメイン層

```typescript
// 値オブジェクトでのバリデーション
export class Email {
  private readonly _value: string;

  constructor(value: string) {
    if (!this.isValid(value)) {
      throw new ValidationError([
        { field: "email", message: "Invalid email format" },
      ]);
    }
    this._value = value;
  }

  private isValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}

// エンティティでのビジネスルールチェック
export class User {
  updateEmail(newEmail: Email): void {
    if (this._isLocked) {
      throw new BusinessRuleViolationError(
        "Cannot update email for locked account"
      );
    }
    this._email = newEmail;
  }
}
```

#### アプリケーション層

```typescript
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly duplicationChecker: UserDuplicationCheckService
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    try {
      // 値オブジェクト生成（バリデーションエラーがthrowされる可能性）
      const email = new Email(input.email);
      const employeeId = new EmployeeId(input.employeeId);

      // 重複チェック
      const isDuplicated = await this.duplicationChecker.isDuplicated(email);
      if (isDuplicated) {
        throw new BusinessRuleViolationError(
          "User with this email already exists"
        );
      }

      // エンティティ作成
      const user = User.create({
        name: input.name,
        email,
        employeeId,
      });

      // 永続化
      await this.userRepository.save(user);

      return {
        id: user.id,
        name: user.name,
        email: user.email.value,
      };
    } catch (error) {
      // ドメインエラーはそのまま再throw
      if (error instanceof AppError) {
        throw error;
      }

      // 予期しないエラーはInfrastructureErrorでラップ
      throw new InfrastructureError("Failed to create user", error as Error);
    }
  }
}
```

#### インフラストラクチャ層

```typescript
export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    try {
      const prismaUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!prismaUser) return null;

      return UserMapper.toDomain(prismaUser);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to find user by id: ${id}`,
        error as Error
      );
    }
  }

  async save(user: User): Promise<void> {
    try {
      const prismaUser = UserMapper.toPrisma(user);

      await prisma.user.upsert({
        where: { id: user.id },
        update: prismaUser,
        create: prismaUser,
      });
    } catch (error) {
      // Prisma固有のエラーを変換
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new BusinessRuleViolationError(
            "User with this email already exists"
          );
        }
      }

      throw new InfrastructureError("Failed to save user", error as Error);
    }
  }
}
```

#### プレゼンテーション層（API Routes）

```typescript
// エラーレスポンスヘルパー
export function errorResponse(error: unknown) {
  // AppErrorの場合
  if (error instanceof AppError) {
    return Response.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error instanceof ValidationError && {
            errors: error.errors,
          }),
        },
      },
      { status: error.statusCode }
    );
  }

  // Zodエラーの場合
  if (error instanceof z.ZodError) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  // 予期しないエラー
  console.error("Unexpected error:", error);
  return Response.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
}

// API Routeでの使用例
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // バリデーション
    const input = createUserSchema.parse(body);

    // ユースケース実行
    const useCase = new CreateUserUseCase(
      new PrismaUserRepository(),
      new UserDuplicationCheckService(new PrismaUserRepository())
    );

    const result = await useCase.execute(input);

    return Response.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
```

### 3.3 エラーロギング

```typescript
// ロガーユーティリティ
export class Logger {
  static error(message: string, error: Error, context?: object) {
    console.error({
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    });
  }

  static warn(message: string, context?: object) {
    console.warn({
      timestamp: new Date().toISOString(),
      level: "warn",
      message,
      ...context,
    });
  }

  static info(message: string, context?: object) {
    console.info({
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      ...context,
    });
  }
}

// 使用例
try {
  await userRepository.save(user);
} catch (error) {
  Logger.error("Failed to save user", error as Error, {
    userId: user.id,
    operation: "save",
  });
  throw new InfrastructureError("Failed to save user", error as Error);
}
```

---

## 4. TypeScript 使用規則

### 4.1 型定義の原則

#### any 型の禁止

```typescript
// ✅ Good
function processUser(user: User): string {
  return user.name;
}

// ❌ Bad
function processUser(user: any): any {
  return user.name;
}

// ⚠️ 許容（型が本当に不明な場合のみ）
function processUnknown(data: unknown): string {
  if (typeof data === "object" && data !== null && "name" in data) {
    return String(data.name);
  }
  return "Unknown";
}
```

#### 明示的な型アノテーション

```typescript
// ✅ Good - 推論が明確
const count = 10; // number型と推論
const users = await getUsers(); // Promise<User[]>と推論

// ✅ Good - パブリックAPI、関数引数・戻り値は明示
export function createUser(name: string, email: string): Promise<User> {
  // ...
}

// ❌ Bad - 複雑な型は明示すべき
const data = await fetchComplexData(); // 型が不明瞭
```

#### Union 型と Narrowing

```typescript
// ✅ Good - 型ガード使用
type Result<T> = { success: true; data: T } | { success: false; error: string };

function processResult(result: Result<User>): string {
  if (result.success) {
    return result.data.name; // data にアクセス可能
  } else {
    return result.error; // error にアクセス可能
  }
}

// ✅ Good - 判別可能なUnion型
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number };

function getArea(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      return shape.width * shape.height;
  }
}
```

### 4.2 Utility Types 活用

```typescript
// Pick - 特定プロパティのみ抽出
type UserCredentials = Pick<User, "email" | "password">;

// Omit - 特定プロパティを除外
type UserWithoutPassword = Omit<User, "password">;

// Partial - 全プロパティをオプショナルに
type UpdateUserInput = Partial<User>;

// Required - 全プロパティを必須に
type CompleteUser = Required<User>;

// Readonly - 全プロパティを読み取り専用に
type ImmutableUser = Readonly<User>;

// Record - キーと値の型を指定
type UserMap = Record<string, User>;

// ReturnType - 関数の戻り値の型を取得
type UserResult = ReturnType<typeof getUser>;
```

### 4.3 Generics（ジェネリクス）

```typescript
// ✅ Good - 再利用可能な型安全な関数
export class Repository<T> {
  constructor(private readonly model: string) {}

  async findById(id: string): Promise<T | null> {
    // ...
  }

  async findAll(): Promise<T[]> {
    // ...
  }

  async save(entity: T): Promise<void> {
    // ...
  }
}

// 使用例
const userRepo = new Repository<User>("user");
const departmentRepo = new Repository<Department>("department");

// ✅ Good - 制約付きジェネリクス
interface HasId {
  id: string;
}

function findById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}
```

### 4.4 strict モード設定

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

## 5. DDD アーキテクチャ実装規則

### 5.1 レイヤー間の依存関係ルール

```
依存の方向: 外側 → 内側のみ

Infrastructure → Application → Domain
                ↓
           Presentation
```

**絶対禁止事項:**

- ドメイン層がアプリケーション層やインフラ層に依存
- アプリケーション層がプレゼンテーション層やインフラ層に依存

```typescript
// ✅ Good - ドメイン層はインターフェースのみ定義
// domain/repositories/IUserRepository.ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// ✅ Good - インフラ層が実装を提供
// infrastructure/repositories/PrismaUserRepository.ts
export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    // Prismaを使用した実装
  }
}

// ✅ Good - アプリケーション層はインターフェースに依存
// application/usecases/CreateUserUseCase.ts
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository // インターフェースに依存
  ) {}
}

// ❌ Bad - ドメイン層が具体実装に依存
import { PrismaClient } from '@prisma/client'; // NG!

export class User {
  async save() {
    const prisma = new PrismaClient(); // NG!
    await prisma.user.create(...);
  }
}
```

### 5.2 エンティティ実装規則

```typescript
// ✅ Good - 完全なエンティティ実装
export class User {
  // プライベートフィールド
  private readonly _id: string;
  private _name: string;
  private _email: Email;
  private _employeeId: EmployeeId;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  // コンストラクタはprivate（ファクトリーメソッド使用）
  private constructor(props: UserProps) {
    this._id = props.id;
    this._name = props.name;
    this._email = props.email;
    this._employeeId = props.employeeId;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // ファクトリーメソッド（新規作成）
  static create(props: CreateUserProps): User {
    // ビジネスルール検証
    if (props.name.length < 2) {
      throw new ValidationError([
        { field: "name", message: "Name must be at least 2 characters" },
      ]);
    }

    return new User({
      id: generateId(),
      name: props.name,
      email: props.email,
      employeeId: props.employeeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // ファクトリーメソッド（再構築）
  static reconstruct(props: UserProps): User {
    return new User(props);
  }

  // ゲッター（イミュータブル）
  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get email(): Email {
    return this._email;
  }

  // ビジネスロジック（振る舞い）
  updateName(newName: string): void {
    if (newName.length < 2) {
      throw new ValidationError([
        { field: "name", message: "Name must be at least 2 characters" },
      ]);
    }
    this._name = newName;
    this._updatedAt = new Date();
  }

  updateEmail(newEmail: Email): void {
    this._email = newEmail;
    this._updatedAt = new Date();
  }

  // エンティティの等価性判定
  equals(other: User): boolean {
    return this._id === other._id;
  }
}

type UserProps = {
  id: string;
  name: string;
  email: Email;
  employeeId: EmployeeId;
  createdAt: Date;
  updatedAt: Date;
};

type CreateUserProps = Omit<UserProps, "id" | "createdAt" | "updatedAt">;
```

### 5.3 値オブジェクト実装規則

```typescript
// ✅ Good - イミュータブルな値オブジェクト
export class Email {
  private readonly _value: string;

  constructor(value: string) {
    // 不変条件の検証
    if (!this.isValid(value)) {
      throw new ValidationError([
        { field: "email", message: "Invalid email format" },
      ]);
    }
    this._value = value.toLowerCase().trim();
  }

  get value(): string {
    return this._value;
  }

  private isValid(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  // 値オブジェクトの等価性（値で比較）
  equals(other: Email): boolean {
    return this._value === other._value;
  }

  // 変更は新しいインスタンスを返す
  changeDomain(newDomain: string): Email {
    const [localPart] = this._value.split("@");
    return new Email(`${localPart}@${newDomain}`);
  }
}

// ❌ Bad - ミュータブルな実装
export class Email {
  value: string; // public & mutable

  constructor(value: string) {
    this.value = value;
  }

  // NG: 状態を変更している
  changeDomain(newDomain: string): void {
    const [localPart] = this.value.split("@");
    this.value = `${localPart}@${newDomain}`;
  }
}
```

### 5.4 リポジトリ実装規則

```typescript
// ✅ Good - インターフェース定義（ドメイン層）
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findAll(options?: FindAllOptions): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

// ✅ Good - 実装（インフラ層）
export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    try {
      const prismaUser = await prisma.user.findUnique({
        where: { id },
      });

      return prismaUser ? UserMapper.toDomain(prismaUser) : null;
    } catch (error) {
      throw new InfrastructureError(
        `Failed to find user by id: ${id}`,
        error as Error
      );
    }
  }

  async save(user: User): Promise<void> {
    try {
      const prismaUser = UserMapper.toPrisma(user);

      await prisma.user.upsert({
        where: { id: user.id },
        update: prismaUser,
        create: prismaUser,
      });
    } catch (error) {
      throw new InfrastructureError("Failed to save user", error as Error);
    }
  }
}

// ❌ Bad - リポジトリがドメインロジックを持つ
export class UserRepository {
  async save(userData: any) {
    // NG: バリデーションはドメイン層の責務
    if (userData.email.length < 5) {
      throw new Error("Invalid email");
    }

    // NG: ビジネスロジックはドメイン層の責務
    if (userData.age < 18) {
      throw new Error("User must be 18 or older");
    }

    await prisma.user.create({ data: userData });
  }
}
```

### 5.5 ユースケース実装規則

```typescript
// ✅ Good - 単一責任のユースケース
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly duplicationChecker: UserDuplicationCheckService
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    // 1. 値オブジェクト生成
    const email = new Email(input.email);
    const employeeId = new EmployeeId(input.employeeId);

    // 2. アプリケーション固有のチェック（重複確認）
    const isDuplicated = await this.duplicationChecker.isDuplicated(email);
    if (isDuplicated) {
      throw new BusinessRuleViolationError(
        "User with this email already exists"
      );
    }

    // 3. エンティティ生成（ドメインロジック実行）
    const user = User.create({
      name: input.name,
      email,
      employeeId,
    });

    // 4. 永続化
    await this.userRepository.save(user);

    // 5. 出力DTOに変換して返却
    return {
      id: user.id,
      name: user.name,
      email: user.email.value,
    };
  }
}

// 入出力DTO
export type CreateUserInput = {
  name: string;
  email: string;
  employeeId: string;
};

export type CreateUserOutput = {
  id: string;
  name: string;
  email: string;
};

// ❌ Bad - 複数の責務を持つユースケース
export class UserUseCase {
  async createUser(data: any) {
    /* ... */
  }
  async updateUser(data: any) {
    /* ... */
  }
  async deleteUser(id: string) {
    /* ... */
  }
  async sendEmail(userId: string) {
    /* ... */
  }
  // → 分割すべき
}
```

### 5.6 認証・認可実装規則

#### 基本方針

認証・認可は以下の原則に従って実装する：

1. **認証（Authentication）**: 「誰か？」を確認 → Presentation層で実装
2. **認可（Authorization）**: 「権限があるか？」を確認 → 性質により適切な層で実装

#### 認証の実装（Presentation層）

認証チェックはServer Actionで**DALパターン**を使用する（Next.js公式推奨）。

```typescript
// src/server/shared/auth/session.ts
import { auth } from "@server/shared/auth/better-auth/auth";
import { headers } from "next/headers";
import { unauthorized } from "next/navigation";

export type Session = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

/**
 * セッション検証（認証のみ）
 */
export async function verifySession(): Promise<Session> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    unauthorized();
  }

  return session;
}

/**
 * 管理者権限を検証（認証 + 管理者認可）
 */
export async function verifyAdmin(): Promise<Session> {
  const session = await verifySession();

  if (session.user.role !== "ADMIN") {
    unauthorized();
  }

  return session;
}

/**
 * リソース所有権を検証（本人または管理者）
 */
export async function verifyOwnerOrAdmin(
  resourceOwnerId: string
): Promise<Session> {
  const session = await verifySession();

  if (session.user.role === "ADMIN") {
    return session;
  }

  if (session.user.id !== resourceOwnerId) {
    unauthorized();
  }

  return session;
}
```

**Server Actionでの使用例：**

```typescript
// src/app/(features)/employees/new/actions.ts
"use server";

import { verifyAdmin } from "@server/shared/auth/session";

export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // 認証 + 管理者権限チェック
  await verifyAdmin();

  // ビジネスロジック...
}
```

#### 認可の配置（層による使い分け）

認可の性質によって適切な層に配置する：

| 認可の種類 | 配置場所 | 例 |
|-----------|---------|-----|
| ロールベース（RBAC） | Presentation層 | `verifyAdmin()` |
| リソース所有権（シンプル） | Presentation層 | `verifyOwnerOrAdmin(id)` |
| ビジネスルール依存 | Application層 | 「承認済みは編集不可」 |
| ドメイン不変条件 | Domain層 | `Employee.canBeUpdatedBy(actor)` |

**判断フローチャート：**

```
認可ルールの判断
    │
    ├─ セッション/ロールのみで判断可能？
    │   └─ Yes → Presentation層
    │
    ├─ エンティティの状態に依存？
    │   └─ Yes → Application層 or Domain層
    │
    └─ ビジネスルールの中核？
        └─ Yes → Domain層（Entity/Value Object）
```

#### ビジネスルールに基づく認可（Application層 + Domain層）

エンティティの状態に依存する認可はApplication層で呼び出し、ロジック自体はDomain層に持たせる。

```typescript
// Domain層: src/server/subdomains/employee/domain/entities/Employee.ts
export class Employee {
  /**
   * この従業員を更新できるか判定
   */
  canBeUpdatedBy(actor: Actor): boolean {
    return actor.role === "ADMIN" || actor.id === this.id;
  }

  /**
   * この従業員を削除できるか判定
   */
  canBeDeletedBy(actor: Actor): boolean {
    // 自分自身は削除不可
    if (actor.id === this.id) return false;
    // 管理者のみ削除可能
    return actor.role === "ADMIN";
  }
}
```

```typescript
// Application層: src/server/subdomains/employee/application/commands/UpdateEmployeeCommand.ts
export class UpdateEmployeeCommand {
  async execute(input: UpdateEmployeeInput, actor: Actor) {
    const employee = await this.repository.findById(input.id);

    if (!employee) {
      throw new NotFoundError("Employee", input.id);
    }

    // Domain層の認可ロジックを呼び出す
    if (!employee.canBeUpdatedBy(actor)) {
      throw new AuthorizationError("更新権限がありません");
    }

    // ロール変更は管理者のみ
    if (input.role !== employee.role && actor.role !== "ADMIN") {
      throw new AuthorizationError("ロール変更は管理者のみ可能です");
    }

    // 更新処理...
  }
}
```

```typescript
// Presentation層: Server Action
"use server";

export async function updateEmployee(...) {
  const session = await verifySession(); // 認証のみ

  // Application層に委譲（actorを渡す）
  await command.execute(input, {
    id: session.user.id,
    role: session.user.role as Role,
  });
}
```

#### Actor型の設計

Application層・Domain層で使う「操作者」の型を定義する。セッション全体ではなく必要な情報のみを渡すことで、Domain層がHTTP層に依存しない設計にする。

```typescript
// src/server/shared/types/Actor.ts
export type Actor = {
  id: string;
  role: Role;
};
```

#### アンチパターン

**❌ Domain層でSessionを参照**

```typescript
// ❌ Domain層がHTTP層の概念に依存
class Employee {
  canBeUpdatedBy(session: Session): boolean { // NG
    return session.user.id === this.id;
  }
}
```

```typescript
// ✅ Actor型を使う
class Employee {
  canBeUpdatedBy(actor: Actor): boolean {
    return actor.id === this.id;
  }
}
```

**❌ 認可ロジックの重複**

```typescript
// ❌ 同じロジックがPresentation層とApplication層に重複
// actions.ts
if (session.user.id !== employeeId && session.user.role !== "ADMIN") { ... }

// UpdateEmployeeCommand.ts
if (actor.id !== input.id && actor.role !== "ADMIN") { ... }
```

```typescript
// ✅ Domain層に集約
class Employee {
  canBeUpdatedBy(actor: Actor): boolean {
    return actor.role === "ADMIN" || actor.id === this.id;
  }
}

// 各層から呼び出す
if (!employee.canBeUpdatedBy(actor)) { ... }
```

**❌ 全ての認可をPresentation層で処理**

ビジネスルールに依存する認可をPresentation層に書くと、ドメイン知識が漏れる。

```typescript
// ❌ ビジネスルールがPresentation層に漏れている
export async function updateEstimate(...) {
  await verifySession();

  // これはビジネスルール、Presentation層に書くべきではない
  const estimate = await repository.findById(id);
  if (estimate.status === "APPROVED") {
    return { error: "承認済みは編集できません" };
  }
}
```

```typescript
// ✅ Application層に委譲
export async function updateEstimate(...) {
  const session = await verifySession();
  await command.execute(input, {
    id: session.user.id,
    role: session.user.role,
  });
}
```

#### 参考資料

- `learning/server-action-auth-patterns.md` - Server Actionでの認証処理パターン比較
- `learning/resource-based-authorization.md` - リソースベース認可の実装パターン
- `learning/ddd-auth-layer-placement.md` - DDDの観点から認証・認可の配置

---

## 6. コメント規則

### 6.1 コメントの原則

**コメントを書くべき場合:**

- Why（なぜそうしたか）を説明
- 複雑なビジネスロジックの意図
- 外部仕様・制約の説明
- TODO・FIXME・NOTE の記載

**コメント不要な場合:**

- What（何をしているか）はコードで表現
- 自明なコード

### 6.2 JSDoc 形式

````typescript
/**
 * ユーザーを作成するユースケース
 *
 * メールアドレスと社員番号の重複チェックを行い、
 * 新規ユーザーをシステムに登録します。
 *
 * @throws {ValidationError} 入力値が不正な場合
 * @throws {BusinessRuleViolationError} メールアドレスまたは社員番号が重複している場合
 * @throws {InfrastructureError} データベース操作が失敗した場合
 */
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly duplicationChecker: UserDuplicationCheckService
  ) {}

  /**
   * ユースケースを実行します
   *
   * @param input - ユーザー作成に必要な入力データ
   * @returns 作成されたユーザーの情報
   *
   * @example
   * ```typescript
   * const useCase = new CreateUserUseCase(repository, checker);
   * const result = await useCase.execute({
   *   name: 'John Doe',
   *   email: 'john@example.com',
   *   employeeId: 'EMP000001',
   * });
   * console.log(result.id); // 'clx123...'
   * ```
   */
  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    // 実装
  }
}
````

### 6.3 インラインコメント

```typescript
// ✅ Good - 意図や理由を説明
export class User {
  updateEmail(newEmail: Email): void {
    // NOTE: メールアドレス変更時は再認証が必要なため、
    // 認証済みフラグをfalseにリセットする
    this._email = newEmail;
    this._isVerified = false;
    this._updatedAt = new Date();
  }

  calculateDiscount(): number {
    // BUSINESS_RULE: 社員歴3年以上の場合、10%割引を適用
    // 参考: 人事規定第12条
    if (this.yearsOfService >= 3) {
      return 0.1;
    }
    return 0;
  }
}

// ❌ Bad - 自明なコメント
const users = []; // ユーザーの配列
let count = 0; // カウント変数
count++; // カウントを1増やす
```

### 6.4 特殊コメント

```typescript
// TODO: 今後実装予定の機能
// TODO(username): 担当者を明記
// TODO: [2025-12-31] 期限付き

// FIXME: 既知のバグ・修正が必要
// FIXME: パフォーマンス問題 - N+1クエリ発生中

// NOTE: 重要な注記
// NOTE: この実装は一時的なもので、Phase2で置き換え予定

// HACK: 技術的負債・不本意な実装
// HACK: ライブラリのバグ回避のための回避策

// DEPRECATED: 非推奨
// DEPRECATED: このメソッドは削除予定。代わりに newMethod() を使用してください

/**
 * @deprecated v2.0.0から非推奨 - {@link newCreateUser} を使用してください
 */
export function createUser() {
  // ...
}
```

---

## 7. テストコード規則

### 7.1 テストファイル配置

```
src/
├── domain/
│   ├── entities/
│   │   ├── User.ts
│   │   └── __tests__/
│   │       └── User.test.ts
│   └── valueObjects/
│       ├── Email.ts
│       └── __tests__/
│           └── Email.test.ts
```

### 7.2 テスト命名規則

```typescript
// ✅ Good - describe / it パターン
describe("User", () => {
  describe("create", () => {
    it("should create user with valid input", () => {
      // Arrange
      const props = {
        name: "John Doe",
        email: new Email("john@example.com"),
        employeeId: new EmployeeId("EMP000001"),
      };

      // Act
      const user = User.create(props);

      // Assert
      expect(user.name).toBe("John Doe");
      expect(user.email.value).toBe("john@example.com");
    });

    it("should throw ValidationError when name is too short", () => {
      const props = {
        name: "J", // 短すぎる
        email: new Email("john@example.com"),
        employeeId: new EmployeeId("EMP000001"),
      };

      expect(() => User.create(props)).toThrow(ValidationError);
    });
  });

  describe("updateEmail", () => {
    it("should update email and reset verification status", () => {
      // ...
    });
  });
});

// ❌ Bad - 不明瞭なテスト名
describe("User", () => {
  it("test1", () => {
    /* ... */
  });
  it("test2", () => {
    /* ... */
  });
});
```

### 7.3 AAA (Arrange-Act-Assert) パターン

```typescript
it("should create user with valid input", () => {
  // Arrange - テストデータの準備
  const email = new Email("test@example.com");
  const employeeId = new EmployeeId("EMP000001");
  const props = {
    name: "Test User",
    email,
    employeeId,
  };

  // Act - テスト対象の実行
  const user = User.create(props);

  // Assert - 結果の検証
  expect(user).toBeDefined();
  expect(user.name).toBe("Test User");
  expect(user.email).toBe(email);
  expect(user.employeeId).toBe(employeeId);
});
```

### 7.4 モック・スタブの使用

```typescript
describe("CreateUserUseCase", () => {
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockDuplicationChecker: jest.Mocked<UserDuplicationCheckService>;
  let useCase: CreateUserUseCase;

  beforeEach(() => {
    // モックの作成
    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockDuplicationChecker = {
      isDuplicated: jest.fn(),
    } as any;

    useCase = new CreateUserUseCase(mockUserRepository, mockDuplicationChecker);
  });

  it("should create user successfully", async () => {
    // Arrange
    mockDuplicationChecker.isDuplicated.mockResolvedValue(false);
    mockUserRepository.save.mockResolvedValue(undefined);

    const input: CreateUserInput = {
      name: "John Doe",
      email: "john@example.com",
      employeeId: "EMP000001",
    };

    // Act
    const result = await useCase.execute(input);

    // Assert
    expect(result).toBeDefined();
    expect(result.name).toBe("John Doe");
    expect(mockDuplicationChecker.isDuplicated).toHaveBeenCalledTimes(1);
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
  });

  it("should throw error when email is duplicated", async () => {
    // Arrange
    mockDuplicationChecker.isDuplicated.mockResolvedValue(true);

    const input: CreateUserInput = {
      name: "John Doe",
      email: "john@example.com",
      employeeId: "EMP000001",
    };

    // Act & Assert
    await expect(useCase.execute(input)).rejects.toThrow(
      BusinessRuleViolationError
    );
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });
});
```

### 7.5 テストカバレッジ目標

```typescript
// ドメイン層: 90%以上
// - すべてのビジネスルールをテスト
// - 境界値テスト必須
// - 異常系テスト必須

describe("Email", () => {
  // 正常系
  it("should accept valid email", () => {
    expect(() => new Email("test@example.com")).not.toThrow();
  });

  // 境界値テスト
  it("should accept email with maximum length", () => {
    const longEmail = "a".repeat(64) + "@" + "b".repeat(63) + ".com";
    expect(() => new Email(longEmail)).not.toThrow();
  });

  // 異常系テスト
  it("should reject email without @", () => {
    expect(() => new Email("invalid.email.com")).toThrow(ValidationError);
  });

  it("should reject empty email", () => {
    expect(() => new Email("")).toThrow(ValidationError);
  });

  it("should reject email with spaces", () => {
    expect(() => new Email("test @example.com")).toThrow(ValidationError);
  });
});
```

### 7.6 テストデータ戦略（レイヤー別）

| 対象                      | データソース | 理由                                                          |
| ------------------------- | ------------ | ------------------------------------------------------------- |
| Value Object / Entity     | インメモリ   | 永続化は責務外。ビジネスルールのみをテスト                    |
| Application 層（UseCase） | モック       | Repository インターフェースをモックし、ビジネスロジックに集中 |
| Repository 実装           | 実 DB        | SQL/Prisma クエリが正しく動くか検証が必要                     |
| 統合テスト / E2E          | 実 DB        | レイヤー間の連携、実際のデータフローを検証                    |

---

## 8. コードレビューチェックリスト

### 8.1 レビュー観点

#### アーキテクチャ

- [ ] レイヤー間の依存関係は正しいか
- [ ] ドメイン層が外部ライブラリに依存していないか
- [ ] 責務が適切なレイヤーに配置されているか

#### コード品質

- [ ] 命名規則に従っているか
- [ ] 関数が 50 行以内に収まっているか
- [ ] DRY 原則に従っているか
- [ ] SOLID 原則に従っているか

#### 型安全性

- [ ] any 型を使用していないか
- [ ] 適切な型アノテーションがあるか
- [ ] null/undefined の扱いが適切か

#### エラーハンドリング

- [ ] 適切なエラークラスを使用しているか
- [ ] エラーメッセージは明確か
- [ ] エラーログは適切に出力されているか

#### テスト

- [ ] ユニットテストが書かれているか
- [ ] 正常系・異常系・境界値をテストしているか
- [ ] テストカバレッジが目標値を達成しているか

#### セキュリティ

- [ ] SQL インジェクション対策ができているか
- [ ] XSS 対策ができているか
- [ ] 認証・認可チェックが適切か
- [ ] 機密情報がログに出力されていないか

#### パフォーマンス

- [ ] N+1 問題が発生していないか
- [ ] 不要なデータベースクエリがないか
- [ ] 適切にインデックスが設定されているか

---

## 9. 実装例：完全な CRUD 操作

### 9.1 ドメイン層

```typescript
// domain/entities/User.ts
export class User {
  private readonly _id: string;
  private _name: string;
  private _email: Email;
  private _employeeId: EmployeeId;
  private _role: Role;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: UserProps) {
    this._id = props.id;
    this._name = props.name;
    this._email = props.email;
    this._employeeId = props.employeeId;
    this._role = props.role;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateUserProps): User {
    if (props.name.length < 2) {
      throw new ValidationError([
        { field: "name", message: "Name must be at least 2 characters" },
      ]);
    }

    return new User({
      id: generateId(),
      name: props.name,
      email: props.email,
      employeeId: props.employeeId,
      role: props.role || Role.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstruct(props: UserProps): User {
    return new User(props);
  }

  // Getters
  get id(): string {
    return this._id;
  }
  get name(): string {
    return this._name;
  }
  get email(): Email {
    return this._email;
  }
  get employeeId(): EmployeeId {
    return this._employeeId;
  }
  get role(): Role {
    return this._role;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business logic
  updateName(newName: string): void {
    if (newName.length < 2) {
      throw new ValidationError([
        { field: "name", message: "Name must be at least 2 characters" },
      ]);
    }
    this._name = newName;
    this._updatedAt = new Date();
  }

  updateEmail(newEmail: Email): void {
    this._email = newEmail;
    this._updatedAt = new Date();
  }

  promoteToAdmin(): void {
    this._role = Role.ADMIN;
    this._updatedAt = new Date();
  }

  equals(other: User): boolean {
    return this._id === other._id;
  }
}

// domain/repositories/IUserRepository.ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findAll(options?: FindAllOptions): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### 9.2 アプリケーション層

```typescript
// application/usecases/CreateUserUseCase.ts
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly duplicationChecker: UserDuplicationCheckService
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    const email = new Email(input.email);
    const employeeId = new EmployeeId(input.employeeId);

    const isDuplicated = await this.duplicationChecker.isDuplicated(email);
    if (isDuplicated) {
      throw new BusinessRuleViolationError(
        "User with this email already exists"
      );
    }

    const user = User.create({
      name: input.name,
      email,
      employeeId,
    });

    await this.userRepository.save(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email.value,
    };
  }
}
```

### 9.3 インフラストラクチャ層

```typescript
// infrastructure/repositories/PrismaUserRepository.ts
export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    try {
      const prismaUser = await prisma.user.findUnique({ where: { id } });
      return prismaUser ? UserMapper.toDomain(prismaUser) : null;
    } catch (error) {
      throw new InfrastructureError(
        `Failed to find user by id: ${id}`,
        error as Error
      );
    }
  }

  async save(user: User): Promise<void> {
    try {
      const prismaUser = UserMapper.toPrisma(user);
      await prisma.user.upsert({
        where: { id: user.id },
        update: prismaUser,
        create: prismaUser,
      });
    } catch (error) {
      throw new InfrastructureError("Failed to save user", error as Error);
    }
  }
}
```

### 9.4 プレゼンテーション層

```typescript
// app/api/users/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createUserSchema.parse(body);

    const useCase = new CreateUserUseCase(
      new PrismaUserRepository(),
      new UserDuplicationCheckService(new PrismaUserRepository())
    );

    const result = await useCase.execute(input);

    return Response.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
```

---

## 10. まとめ

このガイドラインは、高品質で保守性の高いコードを書くための基準です。

### 重要原則

1. **型安全性**: TypeScript の型システムを最大限活用
2. **レイヤー分離**: DDD アーキテクチャの依存関係を厳守
3. **エラーハンドリング**: 適切なエラークラスと処理
4. **テスタビリティ**: テストしやすい設計
5. **可読性**: 明確な命名とコメント

### 継続的改善

- コードレビューでの指摘事項を反映
- チーム内での議論を通じた改善
- 新しいベストプラクティスの取り込み

---

**更新履歴**

| バージョン | 日付       | 変更内容 |
| ---------- | ---------- | -------- |
| 1.0        | 2025-10-07 | 初版作成 |
| 1.1        | 2025-12-12 | 5.6 認証・認可実装規則を追加 |
