import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 会社名値オブジェクト
 */
export class CompanyName extends StringValueObject<"CompanyName"> {
  protected static readonly LABEL = "会社名";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 100;

  constructor(value: string) {
    super(value.trim());
  }
}
