import type { TaxRateRepository } from "../../domain/repositories/TaxRateRepository";

export type ResolveEffectiveTaxRateInput = {
  /** 有効税率を解決する基準日（JST 固定パース済みの Date）。 */
  date: Date;
};

/**
 * 基準日に有効な消費税率を解決する読み取りクエリ（C1 作成画面のプレビュー用）。
 *
 * 見積年月日の変更に追従して税率を read-only 表示／明細プレビューに供給する。マスタ最古行
 * より前など該当が無い場合は `null` を返し（想定内の表示不能）、UI 側で「税率未設定」を扱う。
 * 編集画面と同じ `findEffectiveAt` を共有し、表示ロジックを統一する。
 */
export class ResolveEffectiveTaxRateQuery {
  constructor(private readonly taxRateRepository: TaxRateRepository) {}

  async execute(input: ResolveEffectiveTaxRateInput): Promise<number | null> {
    const master = await this.taxRateRepository.findEffectiveAt(input.date);
    return master?.rate.value ?? null;
  }
}
