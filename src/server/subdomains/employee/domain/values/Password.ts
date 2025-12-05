import { StringValueObject } from "@server/shared/StringValueObject";

export class Password extends StringValueObject<"Password"> {
  protected static readonly MIN_LENGTH = 10;
  protected static readonly MAX_LENGTH = 24;
  // アルファベットの小文字、大文字、数字、記号を含むMIN_LENGTH以上、MAX_LENGTH以下の文字列
  protected static readonly REGEX = new RegExp(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/
  );

  protected static readonly ERROR_MESSAGE_TOO_SHORT =
    "パスワードは{min}文字以上である必要があります";
  protected static readonly ERROR_MESSAGE_TOO_LONG =
    "パスワードは{max}文字以下である必要があります";
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "パスワードは小文字、大文字、数字、記号を含む必要があります";

  constructor(value: string) {
    super(value.trim());
  }

  protected validate(value: string): void {
    // 基本的な長さチェックと正規表現チェックは親クラスで実行
    super.validate(value);

    // Password固有のバリデーション（追加があればここに記述）
  }
}
