import { StringValueObject } from "@server/shared/StringValueObject";

export class MailAddress extends StringValueObject<"MailAddress"> {
  protected static readonly REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  protected static readonly MIN_LENGTH = 1;
  /**
   * メールアドレスの最大文字数（RFC 5321に基づく）
   */
  protected static readonly MAX_LENGTH = 254;
  protected static readonly ERROR_MESSAGE_TOO_SHORT = "メールアドレスは必須です";
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT = "メールアドレスの形式が正しくありません";

  constructor(value: string) {
    super(value.toLowerCase().trim());
  }

  protected validate(value: string): void {
    // 基本的な長さチェックと正規表現チェックは親クラスで実行
    super.validate(value);

    // MailAddress固有のバリデーション（追加があればここに記述）
  }
}
