import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 緊急対応理由値オブジェクト
 *
 * §6.3 事後修理見積で必須の緊急対応理由。
 * Prisma `AfterRepairEstimateDetail.emergencyReason`（VarChar(2000)）に対応する。
 */
export class EmergencyReason extends StringValueObject<"EmergencyReason"> {
  protected static readonly LABEL = "緊急対応理由";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 2000;

  constructor(value: string) {
    super(value.trim());
  }
}
