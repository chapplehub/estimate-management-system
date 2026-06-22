import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 差戻理由コメントの値オブジェクト
 *
 * 差戻イベント（`EstimateStepRejection.comment`・VarChar(2000)）に対応する。
 * §3.4「差戻理由は必須」を型で強制するため、空許容の {@link Memo} とは別物として
 * 必須・空不可（MIN_LENGTH=1）で定義する。トリム後に空ならバリデーション違反。
 */
export class RejectionComment extends StringValueObject<"RejectionComment"> {
  protected static readonly LABEL = "差戻理由";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 2000;

  constructor(value: string) {
    super(value.trim());
  }
}
