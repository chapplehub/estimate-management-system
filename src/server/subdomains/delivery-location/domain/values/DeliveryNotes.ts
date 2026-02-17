import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 配送備考値オブジェクト
 */
export class DeliveryNotes extends StringValueObject<"DeliveryNotes"> {
  protected static readonly LABEL = "配送備考";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 500;

  constructor(value: string) {
    super(value.trim());
  }
}
