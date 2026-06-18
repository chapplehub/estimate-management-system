import type { Estimate } from "@subdomains/estimate/domain/entities";
import type { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import type { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import type { CreateEstimateCommand, CreateEstimateInput } from "../commands/CreateEstimateCommand";

/**
 * 税率チェック→作成の結果（C1 専用・ADR-0056）。
 *
 * 予測可能な業務分岐（税率不一致）は Result で返し、想定外（適用税率なし・採番衝突・
 * VO 検証失敗）は呼び出し側へ throw で抜ける（ADR-0037/0038）。更新系の
 * {@link import("./checkTaxRateThenSave").TaxCheckedSaveResult} と app-shared 層で対称をなす。
 */
export type TaxCheckedCreateResult =
  | { kind: "created"; estimate: Estimate }
  | { kind: "taxRateMismatch"; estimateDateRate: TaxRate; deadlineRate: TaxRate };

/**
 * 見積作成時の税率「導出＋整合チェック」を 1 箇所に集約した app-shared ラッパ（ADR-0056）。
 *
 * 設計書 §8.7 の税率整合（見積年月日の税率＝締切日の税率）を検証し、不一致なら**作成せず**
 * Result を返す（保存時＝その場で修正）。一致時はそのとき確定した単一税率を採用税率として
 * {@link CreateEstimateCommand} へ注入し作成する。
 *
 * 更新系 `checkTaxRateThenSave`（チェックのみ）と異なり、作成系は税率を導出する。導出は
 * 既存の {@link TaxRateConsistencyCheckDomainService}（編集画面と同じ `findEffectiveAt`）を
 * 再利用するため、フォームに税率入力欄を持たせない。`CreateEstimateCommand` は純粋な
 * 組立器のまま据え置き、税率関心はこのラッパが所有する（ADR-0056 の非対称）。
 */
export async function checkTaxRateThenCreate(
  input: Omit<CreateEstimateInput, "taxRate">,
  deps: {
    taxRateConsistencyCheck: TaxRateConsistencyCheckDomainService;
    createCommand: CreateEstimateCommand;
  }
): Promise<TaxCheckedCreateResult> {
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

  const estimate = await deps.createCommand.execute({
    ...input,
    taxRate: result.rate.value,
  });
  return { kind: "created", estimate };
}
