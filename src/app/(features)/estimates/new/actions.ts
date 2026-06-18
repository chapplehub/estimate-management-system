"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { checkTaxRateThenCreate } from "@subdomains/estimate/application/shared/checkTaxRateThenCreate";
import { checkTaxRateThenCreateDepsFactory } from "@subdomains/estimate/application/factories/checkTaxRateThenCreateDepsFactory";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { fromDateInputValue } from "../_shared/date";
import { taxRateMismatchFormErrors } from "../_shared/tax-rate-format";
import { toVariationContentInputFromNodes } from "../[estimateNumber]/variationContentMapping";
import { createEstimateSchema } from "./schema";

/**
 * 見積新規作成（C1）の Server Action。
 *
 * 単一統合フォーム（ヘッダー＋初期バリ1件）を 1 アクションでまとめて保存し、空見積を構造的に
 * 排除する（≥1 バリの原子的作成）。作成者は session.user.employeeId（null は作成不可）。税率は
 * フォームから受け取らず、見積年月日から app-shared `checkTaxRateThenCreate` が導出する（§A.1 /
 * ADR-0056）。§8.7 税率不一致は例外でなく Result のためフォームエラーで提示し入力を維持する。
 * その他例外は handleCommandError 経由でフォームエラー化する。成功時のみ詳細画面へ redirect。
 * 日付は JST 固定パース（z.coerce.date() は暦日がずれるため使わない）。
 */
export async function createEstimate(_prevState: unknown, formData: FormData) {
  const session = await verifySession();

  const submission = parseWithZod(formData, { schema: createEstimateSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }
  const value = submission.value;

  // 作成者は認証セッションの employeeId に固定する（フォーム改ざん不可・null は作成不可）。
  const createdBy = session.user.employeeId;
  if (!createdBy) {
    return submission.reply({
      formErrors: ["作成者の従業員情報が取得できないため、見積を作成できません。"],
    });
  }

  const content = toVariationContentInputFromNodes(value);

  const input = {
    estimateType: value.estimateType,
    estimateDate: fromDateInputValue(value.estimateDate),
    deadline: fromDateInputValue(value.deadline),
    customerId: value.customerId,
    deliveryLocationId: value.deliveryLocationId,
    taxRoundingType: value.taxRoundingType,
    createdBy,
    departmentId: value.departmentId,
    // 初期バリエーションは正確に1件（variationNumber=1）。2件目以降は詳細画面の C3 で足す。
    variations: [
      {
        variationNumber: 1,
        submissionType: value.submissionType,
        items: content.items,
        setGroups: content.setGroups,
        overallDiscount: content.overallDiscount,
        customerMemo: content.customerMemo,
        internalMemo: content.internalMemo,
      },
    ],
    repairDetail:
      value.estimateType === "REPAIR"
        ? {
            targetProductId: value.repairTargetProductId ?? "",
            faultDescription: value.repairFaultDescription ?? "",
            scheduledRepairDate: fromDateInputValue(value.repairScheduledRepairDate ?? ""),
          }
        : null,
    afterRepairDetail:
      value.estimateType === "AFTER_REPAIR"
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
    result = await checkTaxRateThenCreate(input, checkTaxRateThenCreateDepsFactory());
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({ formErrors: errorMessage ? [errorMessage] : [] });
  }

  // 税率不一致（§8.7）は作成されない。両税率を提示して入力を維持する（文言は複製と共有）。
  if (result.kind === "taxRateMismatch") {
    return submission.reply({
      formErrors: taxRateMismatchFormErrors(
        result.estimateDateRate.value,
        result.deadlineRate.value
      ),
    });
  }

  const estimateNumber = result.estimate.estimateNumber.value;
  revalidatePath(`/estimates/${estimateNumber}`);
  redirect(`/estimates/${estimateNumber}?reason=${REDIRECT_REASON.ESTIMATE_CREATED}`);
}
