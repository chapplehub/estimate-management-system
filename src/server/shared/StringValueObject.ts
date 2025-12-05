import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

/**
 * 文字列型の値オブジェクトの基底クラス
 *
 * サブクラスでREGEX, MIN_LENGTH, MAX_LENGTH, エラーメッセージをオーバーライドして
 * 各値オブジェクト固有のバリデーションを実装する
 */
export abstract class StringValueObject<U> extends ValueObject<string, U> {
  protected static readonly REGEX: RegExp = /^.*$/u;
  protected static readonly MIN_LENGTH: number = 0;
  protected static readonly MAX_LENGTH: number = Number.MAX_SAFE_INTEGER;
  protected static readonly ERROR_MESSAGE_EMPTY: string | null = null;
  protected static readonly ERROR_MESSAGE_TOO_SHORT: string =
    "Length must be at least {min}";
  protected static readonly ERROR_MESSAGE_TOO_LONG: string =
    "Length must be at most {max}";
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT: string =
    "Invalid format";

  constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  protected validate(value: string): void {
    const constructor = this.constructor as typeof StringValueObject;

    // 空文字列チェック（オプション）
    if (value.length === 0 && constructor.ERROR_MESSAGE_EMPTY) {
      throw new ValidationError(constructor.ERROR_MESSAGE_EMPTY);
    }

    // 長さチェック
    if (value.length < constructor.MIN_LENGTH) {
      throw new ValidationError(
        constructor.ERROR_MESSAGE_TOO_SHORT.replace(
          "{min}",
          constructor.MIN_LENGTH.toString()
        )
      );
    }
    if (value.length > constructor.MAX_LENGTH) {
      throw new ValidationError(
        constructor.ERROR_MESSAGE_TOO_LONG.replace(
          "{max}",
          constructor.MAX_LENGTH.toString()
        )
      );
    }

    // 正規表現チェック
    if (!constructor.REGEX.test(value)) {
      throw new ValidationError(constructor.ERROR_MESSAGE_INVALID_FORMAT);
    }
  }
}
