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
