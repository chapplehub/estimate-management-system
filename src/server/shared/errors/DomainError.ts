/**
 * ドメイン層のベースエラークラス
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // スタックトレースを正しく表示
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 不正な引数エラー
 *
 * プログラマーのミスにより、本来渡されるべきでない値（null/undefined等）が
 * 渡された場合に使用する。ユーザー入力のバリデーションエラーではない。
 *
 * @example
 * // ValueObjectの基底クラスでnull/undefinedチェックに使用
 * if (value === null || value === undefined) {
 *   throw new InvalidArgumentError("Value must be defined");
 * }
 */
export class InvalidArgumentError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * バリデーションエラー
 *
 * 値の形式・構文が正しくない場合に使用する。
 * 主にValue Objectのコンストラクタ内で、単一の値を検証する際に使用。
 *
 * @example
 * // メールアドレスの形式チェック
 * if (!EMAIL_REGEX.test(value)) {
 *   throw new ValidationError("メールアドレスの形式が正しくありません");
 * }
 *
 * // 文字数制限チェック
 * if (value.length > 100) {
 *   throw new ValidationError("部署名は100文字以内にしてください");
 * }
 */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * ビジネスルール違反エラー
 *
 * 値自体は正しいが、ビジネスルール上許可されない操作の場合に使用する。
 * 複数のエンティティ間の関係や、システム状態に依存するルール違反に使用。
 *
 * @example
 * // エンティティの不変条件違反
 * if (newParentId === this._id) {
 *   throw new BusinessRuleViolationError("自分自身を親部署にすることはできません");
 * }
 *
 * // 複数エンティティ間のルール
 * if (activeChildren.length > 0) {
 *   throw new BusinessRuleViolationError("有効な子部署が存在するため、この部署を無効化できません");
 * }
 */
export class BusinessRuleViolationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
