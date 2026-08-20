import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { TaxRateMaster } from "@subdomains/estimate/domain/entities/TaxRateMaster";
import { TaxRateRepository } from "@subdomains/estimate/domain/repositories/TaxRateRepository";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";

/**
 * 税率チェックの入力（設計書 §8.7 見積パターン）。
 * 見積年月日・締切日はともに Date で同型のため、取り違え防止にオブジェクト引数とする。
 */
export type TaxRateConsistencyCheckInput = {
  /** 見積年月日 */
  estimateDate: Date;
  /** 締切日 */
  deadline: Date;
};

/**
 * 税率チェックの結果（設計書 §8.7 見積パターン）。
 * 一致時は確定した単一税率を、不一致時は両日付の税率を返す。
 * 「適用税率が見つからない」想定外ケースはユニオンに含めず throw する。
 */
export type TaxRateCheckResult =
  | { kind: "consistent"; rate: TaxRate }
  | { kind: "mismatch"; estimateDateRate: TaxRate; deadlineRate: TaxRate };

/**
 * 税率チェック横断ドメインサービス（設計書 §8.7 見積パターン）。
 *
 * 見積年月日の税率と締切日の税率が一致するか検証する。チェック結果は返す
 * （事実確認型 / ADR-0011）。不一致をエラーとするかは文脈依存（保存・申請=その場で
 * 編集可能 / 受注=新バリエーション作成必須）のため、エラー化は呼び出し側の責務とする。
 */
export class TaxRateConsistencyCheckDomainService {
  constructor(private readonly taxRateRepository: TaxRateRepository) {}

  async check(input: TaxRateConsistencyCheckInput): Promise<TaxRateCheckResult> {
    const estimateDateRate = await this.resolveRate(input.estimateDate);
    const deadlineRate = await this.resolveRate(input.deadline);

    if (estimateDateRate.rate.equals(deadlineRate.rate)) {
      return { kind: "consistent", rate: estimateDateRate.rate };
    }

    return {
      kind: "mismatch",
      estimateDateRate: estimateDateRate.rate,
      deadlineRate: deadlineRate.rate,
    };
  }

  /**
   * 対象日時の適用税率を解決する。該当が無い（マスタ最古行より前）のは想定外状態のため、
   * null をドメイン的意味（BusinessRuleViolationError）に翻訳して即 throw する。
   */
  private async resolveRate(date: Date): Promise<TaxRateMaster> {
    const taxRate = await this.taxRateRepository.findEffectiveAt(date);
    if (taxRate === null) {
      throw new BusinessRuleViolationError("指定された日付に適用される消費税率が見つかりません");
    }
    return taxRate;
  }
}
