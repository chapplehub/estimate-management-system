import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { RoleId } from "../values/RoleId";
import { RoleRepository } from "../repositories/RoleRepository";
import { PositionRepository } from "../repositories/PositionRepository";

/**
 * 課員の上位役割 課長級検証ドメインサービス（ADR-20260707-k4e）
 *
 * 「課員（担当役割を持たない従業員）に明示できる上位役割は課長級のみ」という
 * ビジネスルールを検証する。課長級＝役職階層の葉（下位役職を持たない役職）に属する役割。
 *
 * 既存 SuperiorRoleValidationDomainService（役割の上位役割は役職の1段上に限る）と
 * 同型のティア妥当性検証。課員の一次承認者は構造上その直属の課長であり、これは
 * 役割階層の1段上制約を最下段の担い手である課員に当てはめた特殊ケースにあたる。
 */
export class SuperiorRoleKachouTierValidationDomainService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly positionRepository: PositionRepository
  ) {}

  /**
   * 上位役割が課長級かを検証
   *
   * @param superiorRoleId 課員に設定しようとする上位役割ID
   * @throws BusinessRuleViolationError 役割が存在しない、または課長級でない場合
   */
  async execute(superiorRoleId: RoleId): Promise<void> {
    // 1. 上位役割を取得
    const superiorRole = await this.roleRepository.findById(superiorRoleId);
    if (!superiorRole) {
      throw new BusinessRuleViolationError(`上位役割が存在しません: ID=${superiorRoleId.value}`);
    }

    // 2. その役割の役職が課長級（役職階層の葉）かを判定
    const isKachouTier = await this.positionRepository.isLeafPosition(superiorRole.positionId);
    if (!isKachouTier) {
      throw new BusinessRuleViolationError(
        "課員の上位役割には課長級（役職階層の最下段に属する役割）のみ指定できます"
      );
    }
  }
}
