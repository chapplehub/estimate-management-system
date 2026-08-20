import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 故障内容値オブジェクト
 *
 * §6.2 / §6.3 修理・事後修理見積で必須の故障内容説明。
 * Prisma `RepairEstimateDetail.faultDescription` および
 * `AfterRepairEstimateDetail.faultDescription`（VarChar(2000)）に対応する。
 */
export class FaultDescription extends StringValueObject<"FaultDescription"> {
  protected static readonly LABEL = "故障内容";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 2000;

  constructor(value: string) {
    super(value.trim());
  }
}
