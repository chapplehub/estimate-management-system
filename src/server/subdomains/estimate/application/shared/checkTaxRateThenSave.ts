import type { Estimate } from "@subdomains/estimate/domain/entities";
import type { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import type { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import type { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";

/**
 * 税率チェック→保存の共通結果（C2/C3/C4 共用）。
 *
 * 予測可能な業務分岐（税率不一致）は Result で返し、想定外（適用税率なし・採番衝突・
 * VO 検証失敗・見積不在）は呼び出し側へ throw で抜ける、という方針に従う。
 */
export type TaxCheckedSaveResult =
  | { kind: "saved"; estimate: Estimate }
  | { kind: "taxRateMismatch"; estimateDateRate: TaxRate; deadlineRate: TaxRate };

/**
 * 見積保存時の横断ポリシー（設計書 §8.6 / §8.7）を 1 箇所に集約した共通機構。
 *
 * 見積年月日・締切日の税率一致を検証し、不一致なら**保存せず** Result を返す
 * （§8.7「保存時＝その場で修正」。不整合を確定保存しない意図）。一致時のみ save し
 * 保存済み集約を返す。再計算自体は集約ミューテータが ADR-0028 で自動実行済みのため
 * ここでは行わない。
 */
export async function checkTaxRateThenSave(
  estimate: Estimate,
  deps: {
    taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService;
    estimateRepository: EstimateRepository;
  }
): Promise<TaxCheckedSaveResult> {
  const result = await deps.taxRateConsistencyCheck.check({
    estimateDate: estimate.estimateDate,
    deadline: estimate.deadline,
  });

  if (result.kind === "mismatch") {
    return {
      kind: "taxRateMismatch",
      estimateDateRate: result.estimateDateRate,
      deadlineRate: result.deadlineRate,
    };
  }

  const saved = await deps.estimateRepository.save(estimate);
  return { kind: "saved", estimate: saved };
}
