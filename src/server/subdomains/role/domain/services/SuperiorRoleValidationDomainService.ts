import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { RoleRepository } from "../repositories/RoleRepository";
import { PositionRepository } from "../repositories/PositionRepository";

/**
 * 上位役割バリデーションドメインサービス
 *
 * 「上位役割に指定できるのは、選択した役職の上位役職に属する役割のみ」
 * というビジネスルールを検証する。
 */
export class SuperiorRoleValidationDomainService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly positionRepository: PositionRepository
  ) {}

  /**
   * 上位役割の妥当性を検証
   *
   * @param positionId 当該役割の役職ID
   * @param superiorRoleId 設定しようとする上位役割ID
   * @throws BusinessRuleViolationError バリデーション失敗時
   */
  async execute(positionId: string, superiorRoleId: string): Promise<void> {
    // 1. 当該役職の上位役職IDを取得
    const superiorPositionId = await this.positionRepository.findSuperiorPositionId(positionId);

    // 2. 最上位役職（社長）には上位役割を設定できない
    if (superiorPositionId === null) {
      throw new BusinessRuleViolationError("最上位の役職には上位役割を設定できません");
    }

    // 3. 上位役割を取得
    const superiorRole = await this.roleRepository.findById(superiorRoleId);
    if (!superiorRole) {
      throw new BusinessRuleViolationError(`上位役割が存在しません: ID=${superiorRoleId}`);
    }

    // 4. 上位役割の役職が、当該役職の上位役職と一致するか検証
    if (superiorRole.positionId !== superiorPositionId) {
      throw new BusinessRuleViolationError(
        "上位役割に指定できるのは、選択した役職の上位役職に属する役割のみです"
      );
    }
  }
}
