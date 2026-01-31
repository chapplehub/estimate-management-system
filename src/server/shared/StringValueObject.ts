import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

/**
 * 文字列型の値オブジェクトの基底クラス
 *
 * サブクラスでLABEL, REGEX, MIN_LENGTH, MAX_LENGTH をオーバーライドして
 * 各値オブジェクト固有のバリデーションを実装する。
 *
 * エラーメッセージはLABELを使って自動生成される。
 * 特殊なフォーマットが必要な場合のみエラーメッセージをオーバーライドする。
 */
export abstract class StringValueObject<U> extends ValueObject<string, U> {
  protected static readonly LABEL: string = "値";
  protected static readonly REGEX: RegExp = /^.*$/u;
  protected static readonly MIN_LENGTH: number = 0;
  protected static readonly MAX_LENGTH: number = Number.MAX_SAFE_INTEGER;
  protected static readonly ERROR_MESSAGE_EMPTY: string | null = null;
  protected static readonly ERROR_MESSAGE_TOO_SHORT: string | null = null;
  protected static readonly ERROR_MESSAGE_TOO_LONG: string | null = null;
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT: string = "不正な形式です";

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
      const message = this.getTooShortMessage(constructor);
      throw new ValidationError(message);
    }
    if (value.length > constructor.MAX_LENGTH) {
      const message = this.getTooLongMessage(constructor);
      throw new ValidationError(message);
    }

    // 正規表現チェック
    if (!constructor.REGEX.test(value)) {
      throw new ValidationError(constructor.ERROR_MESSAGE_INVALID_FORMAT);
    }
  }

  /**
   * 最小長エラーメッセージを取得
   * MIN_LENGTH=1 の場合は「{LABEL}は必須です」を返す
   */
  private getTooShortMessage(constructor: typeof StringValueObject): string {
    // カスタムメッセージが定義されている場合はそれを使用
    if (constructor.ERROR_MESSAGE_TOO_SHORT) {
      return constructor.ERROR_MESSAGE_TOO_SHORT.replace("{name}", constructor.LABEL).replace(
        "{min}",
        constructor.MIN_LENGTH.toString()
      );
    }

    // MIN_LENGTH=1 の場合は「必須です」
    if (constructor.MIN_LENGTH === 1) {
      return `${constructor.LABEL}は必須です`;
    }

    // それ以外は「{min}文字以上で入力してください」
    return `${constructor.LABEL}は${constructor.MIN_LENGTH}文字以上で入力してください`;
  }

  /**
   * 最大長エラーメッセージを取得
   */
  private getTooLongMessage(constructor: typeof StringValueObject): string {
    // カスタムメッセージが定義されている場合はそれを使用
    if (constructor.ERROR_MESSAGE_TOO_LONG) {
      return constructor.ERROR_MESSAGE_TOO_LONG.replace("{name}", constructor.LABEL).replace(
        "{max}",
        constructor.MAX_LENGTH.toString()
      );
    }

    return `${constructor.LABEL}は${constructor.MAX_LENGTH}文字以内で入力してください`;
  }
}
