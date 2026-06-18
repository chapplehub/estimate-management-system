import type { Estimate } from "@subdomains/estimate/domain/entities";
import type { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import type { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import type {
  DuplicateEstimateCommand,
  DuplicateEstimateInput,
} from "../commands/DuplicateEstimateCommand";

/**
 * 税率チェック→複製の結果（C6 専用・ADR-0056/0057）。
 *
 * 予測可能な業務分岐（税率不一致）は Result で返し、想定外（適用税率なし・採番衝突・
 * 複製元不在・VO 検証失敗）は呼び出し側へ throw で抜ける（ADR-0037/0038）。作成系の
 * {@link import("./checkTaxRateThenCreate").TaxCheckedCreateResult} と app-shared 層で対称をなす。
 */
export type TaxCheckedDuplicateResult =
  | { kind: "duplicated"; estimate: Estimate }
  | { kind: "taxRateMismatch"; estimateDateRate: TaxRate; deadlineRate: TaxRate };

/**
 * 見積複製時の税率「導出＋整合チェック」を 1 箇所に集約した app-shared ラッパ（ADR-0056/0057）。
 *
 * 設計書 §8.7 の税率整合（見積年月日の税率＝締切日の税率）を検証し、不一致なら**複製せず**
 * Result を返す（その場で修正）。一致時はそのとき確定した単一税率を採用税率として
 * {@link DuplicateEstimateCommand} へ注入し複製する。
 *
 * {@link DuplicateEstimateCommand} は `taxRate` を生値で受け取るのみで §8.7 を保証しないため、
 * 税率関心はこのラッパが所有する。導出は作成系（`checkTaxRateThenCreate`）と同じ
 * {@link TaxRateConsistencyCheckDomainService}（編集画面と同じ `findEffectiveAt`）を再利用し、
 * フォームに税率入力欄を持たせない（ADR-0056 の非対称を複製でも踏襲）。
 */
export async function checkTaxRateThenDuplicate(
  input: Omit<DuplicateEstimateInput, "taxRate">,
  deps: {
    taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService;
    duplicateCommand: DuplicateEstimateCommand;
  }
): Promise<TaxCheckedDuplicateResult> {
  const result = await deps.taxRateConsistencyCheck.check({
    estimateDate: input.estimateDate,
    deadline: input.deadline,
  });

  if (result.kind === "mismatch") {
    return {
      kind: "taxRateMismatch",
      estimateDateRate: result.estimateDateRate,
      deadlineRate: result.deadlineRate,
    };
  }

  const estimate = await deps.duplicateCommand.execute({
    ...input,
    taxRate: result.rate.value,
  });
  return { kind: "duplicated", estimate };
}
