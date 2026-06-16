"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { getEstimateDetailQueryFactory } from "@subdomains/estimate/application/factories/estimateQueryFactory";
import { updateEstimateCommandFactory } from "@subdomains/estimate/application/factories/updateEstimateCommandFactory";
import { updateVariationCommandFactory } from "@subdomains/estimate/application/factories/updateVariationCommandFactory";
import type { UpdateEstimateInput } from "@subdomains/estimate/application/commands/UpdateEstimateCommand";
import type { UpdateVariationInput } from "@subdomains/estimate/application/commands/UpdateVariationCommand";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { fromDateInputValue } from "../_shared/date";
import { updateEstimateHeaderSchema } from "./schema";
import { updateVariationContentNodeSchema } from "./variationSchema";
import { toVariationContentInputFromNodes } from "./variationContentMapping";

/**
 * 見積ヘッダー更新（C2）の Server Action。
 *
 * estimateId と estimateType は estimateNumber から DTO を引いて解決する（version は
 * 改ざん防止のためフォーム由来のトークンを使う・ADR-0039）。日付は JST 固定パース。
 * 税率不一致（§8.7）は例外でなく Result のためフォームエラーで提示し編集を維持する。
 * 競合・その他例外は handleCommandError 経由でフォームエラー化する。成功時のみ redirect。
 */
export async function updateEstimateHeader(
  estimateNumber: string,
  _prevState: unknown,
  formData: FormData
) {
  await verifySession();

  const submission = parseWithZod(formData, { schema: updateEstimateHeaderSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }
  const value = submission.value;

  const dto = await getEstimateDetailQueryFactory().execute({ estimateNumber });
  if (!dto) {
    return submission.reply({ formErrors: ["見積が見つかりません"] });
  }

  const input: UpdateEstimateInput = {
    estimateId: dto.estimateId,
    version: value.version,
    estimateDate: fromDateInputValue(value.estimateDate),
    deadline: fromDateInputValue(value.deadline),
    customerId: value.customerId,
    deliveryLocationId: value.deliveryLocationId,
    departmentId: value.departmentId,
    taxRoundingType: value.taxRoundingType,
    repairDetail:
      dto.estimateType === "REPAIR"
        ? {
            targetProductId: value.repairTargetProductId ?? "",
            faultDescription: value.repairFaultDescription ?? "",
            scheduledRepairDate: fromDateInputValue(value.repairScheduledRepairDate ?? ""),
          }
        : null,
    afterRepairDetail:
      dto.estimateType === "AFTER_REPAIR"
        ? {
            targetProductId: value.afterRepairTargetProductId ?? "",
            faultDescription: value.afterRepairFaultDescription ?? "",
            actualRepairDate: fromDateInputValue(value.afterRepairActualRepairDate ?? ""),
            emergencyReason: value.afterRepairEmergencyReason ?? "",
          }
        : null,
  };

  let result;
  try {
    result = await updateEstimateCommandFactory().execute(input);
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({ formErrors: errorMessage ? [errorMessage] : [] });
  }

  // 税率不一致（§8.7）は保存されない。両税率を提示して編集を維持する。
  if (result.kind === "taxRateMismatch") {
    const estimateDatePct = Math.round(result.estimateDateRate.value * 100);
    const deadlinePct = Math.round(result.deadlineRate.value * 100);
    return submission.reply({
      formErrors: [
        `見積年月日（${estimateDatePct}%）と締切日（${deadlinePct}%）で税率が異なります。日付を確認してください（§8.7）。`,
      ],
    });
  }

  revalidatePath(`/estimates/${estimateNumber}`);
  redirect(`/estimates/${estimateNumber}?reason=${REDIRECT_REASON.ESTIMATE_UPDATED}`);
}

/**
 * バリエーション内容更新（C4）の Server Action。
 *
 * 対象は estimateNumber（→ DTO で estimateId 解決）と form の variationId で特定する。明細は
 * 単一 hidden の JSON（通常明細・セット群のノード union・ADR-0047/0050）を schema で検証し、
 * sortOrder は配列順から導出して `VariationContentInput`（items＋setGroups）へ写す
 * （toVariationContentInputFromNodes）。C4 はバリ内容を宣言的に全置換する。
 * version はフォーム由来の楽観ロックトークン（ADR-0039）。税率不一致（§8.7）は例外でなく
 * Result のためフォームエラーで提示し編集を維持する。競合・その他例外は handleCommandError 経由。
 * 成功時のみ redirect で閲覧へ戻る（S3 ヘッダー編集と同型）。
 */
export async function updateVariationContent(
  estimateNumber: string,
  _prevState: unknown,
  formData: FormData
) {
  await verifySession();

  const submission = parseWithZod(formData, { schema: updateVariationContentNodeSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }
  const value = submission.value;

  const dto = await getEstimateDetailQueryFactory().execute({ estimateNumber });
  if (!dto) {
    return submission.reply({ formErrors: ["見積が見つかりません"] });
  }

  const input: UpdateVariationInput = {
    estimateId: dto.estimateId,
    variationId: value.variationId,
    version: value.version,
    content: toVariationContentInputFromNodes(value),
  };

  let result;
  try {
    result = await updateVariationCommandFactory().execute(input);
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({ formErrors: errorMessage ? [errorMessage] : [] });
  }

  // 税率不一致（§8.7）は保存されない。両税率を提示して編集を維持する。
  if (result.kind === "taxRateMismatch") {
    const estimateDatePct = Math.round(result.estimateDateRate.value * 100);
    const deadlinePct = Math.round(result.deadlineRate.value * 100);
    return submission.reply({
      formErrors: [
        `見積年月日（${estimateDatePct}%）と締切日（${deadlinePct}%）で税率が異なります。日付を確認してください（§8.7）。`,
      ],
    });
  }

  revalidatePath(`/estimates/${estimateNumber}`);
  redirect(`/estimates/${estimateNumber}?reason=${REDIRECT_REASON.ESTIMATE_UPDATED}`);
}
