/**
 * ドメイン層のベースエラークラス
 * TODO: どういうエラーが必要か考える
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // スタックトレースを正しく表示
    Error.captureStackTrace(this, this.constructor);
  }
}

export class InvalidArgumentError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * ビジネスルール違反エラー
 */
export class BusinessRuleViolationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * エンティティが見つからないエラー
 */
export class NotFoundError extends DomainError {
  constructor(message: string);
  constructor(
    entityClass: { ENTITY_NAME: string },
    identifier: Record<string, unknown>
  );
  constructor(
    messageOrEntityClass: string | { ENTITY_NAME: string },
    identifier?: Record<string, unknown>
  ) {
    if (typeof messageOrEntityClass === "string") {
      // 従来の使い方: new NotFoundError("メッセージ")
      super(messageOrEntityClass);
    } else {
      // 新しい使い方: new NotFoundError(Employee, { id: "xxx" })
      const entityName = messageOrEntityClass.ENTITY_NAME;
      const identifierStr = Object.entries(identifier!)
        .map(([key, value]) => `${key.toUpperCase()}=${value}`)
        .join(", ");
      super(`${entityName}が見つかりません: ${identifierStr}`);
    }
  }
}
