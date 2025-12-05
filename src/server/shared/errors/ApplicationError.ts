/**
 * アプリケーション層のベースエラークラス
 *
 * ユースケース実行時の前提条件が満たされない場合など、
 * アプリケーション層で発生するエラーの基底クラス
 */
export class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // スタックトレースを正しく表示
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * リソースが見つからないエラー（汎用）
 */
export class NotFoundError extends ApplicationError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * エンティティが見つからないエラー（エンティティ専用）
 *
 * エンティティクラスのメタ情報（ENTITY_NAME）を使ってエラーメッセージを自動生成する
 *
 * @example
 * throw new NotFoundEntityError(Employee, { employeeCd: "EMP000001" });
 * // → "従業員が見つかりません: EMPLOYEECD=EMP000001"
 */
export class NotFoundEntityError extends ApplicationError {
  constructor(
    entityClass: { ENTITY_NAME: string },
    identifier: Record<string, unknown>
  ) {
    const entityName = entityClass.ENTITY_NAME;
    const identifierStr = Object.entries(identifier)
      .map(([key, value]) => `${key.toUpperCase()}=${value}`)
      .join(", ");
    super(`${entityName}が見つかりません: ${identifierStr}`);
  }
}
