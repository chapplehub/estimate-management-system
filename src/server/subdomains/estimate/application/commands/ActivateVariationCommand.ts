import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";

/**
 * バリエーション有効化コマンドの入力。
 *
 * 集約は estimateId からのみロードできるため対象特定に variationId を併せて受け取る。
 */
export type ActivateVariationInput = {
  estimateId: string;
  variationId: string;
  /** 画面表示時に取得した親見積の楽観ロックトークン（ADR-0039）。フォーム往復で持ち回る */
  expectedVersion: number;
};

/**
 * バリエーション有効化コマンド（ADR-0018 で無効化と分離）。
 *
 * 流れ: 既存集約をロード → ルート activateVariation で status を ACTIVE に → version 付きで
 * 保存。有効化には進行ロックのガードを置かない（無効バリの再有効化は申請・受注を壊さない・
 * ADR-0061）。金額・税額を動かさないため税率整合チェックを通さない素の update とする
 * （DeactivateVariationCommand と同型・ADR-0037 で戻り値は保存済み集約）。
 *
 * 冪等: 既に ACTIVE でもドメインが status を上書きするだけでエラーにしない。並行競合は
 * ルート version の ConflictError（ADR-0039）が防御する。
 */
export class ActivateVariationCommand {
  constructor(private readonly estimateRepository: EstimateRepository) {}

  async execute(input: ActivateVariationInput): Promise<Estimate> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    estimate.activateVariation(new EstimateVariationId(input.variationId));

    return this.estimateRepository.update(estimate, input.expectedVersion);
  }
}
