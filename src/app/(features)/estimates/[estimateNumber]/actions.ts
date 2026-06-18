"use server";

import { verifySession } from "@/app/_lib/verifyAuthentication";
import { parseWithZod } from "@conform-to/zod/v4";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { getEstimateDetailQueryFactory } from "@subdomains/estimate/application/factories/estimateQueryFactory";
import { updateEstimateCommandFactory } from "@subdomains/estimate/application/factories/updateEstimateCommandFactory";
import { updateVariationCommandFactory } from "@subdomains/estimate/application/factories/updateVariationCommandFactory";
import { addVariationCommandFactory } from "@subdomains/estimate/application/factories/addVariationCommandFactory";
import { checkTaxRateThenDuplicateDepsFactory } from "@subdomains/estimate/application/factories/checkTaxRateThenDuplicateDepsFactory";
import { checkTaxRateThenDuplicate } from "@subdomains/estimate/application/shared/checkTaxRateThenDuplicate";
import { reviseForCustomerCommandFactory } from "@subdomains/estimate/application/factories/reviseForCustomerCommandFactory";
import type { UpdateEstimateInput } from "@subdomains/estimate/application/commands/UpdateEstimateCommand";
import type { UpdateVariationInput } from "@subdomains/estimate/application/commands/UpdateVariationCommand";
import type { AddVariationInput } from "@subdomains/estimate/application/commands/AddVariationCommand";
import type { ReviseForCustomerInput } from "@subdomains/estimate/application/commands/ReviseForCustomerCommand";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleCommandError } from "../../_shared/error-handler";
import { fromDateInputValue } from "../_shared/date";
import { taxRateMismatchFormErrors } from "../_shared/tax-rate-format";
import { duplicateEstimateSchema } from "./duplicateSchema";
import { updateEstimateHeaderSchema } from "./schema";
import { addVariationNodeSchema, updateVariationContentNodeSchema } from "./variationSchema";
import { reviseForCustomerSchema } from "./reviseForCustomerSchema";
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
 * バリエーション追加（C3・新規追加／複製プリフィル）の Server Action。
 *
 * estimateId は estimateNumber から DTO 解決し、`submissionType` は作成時に確定する不変属性
 * （ADR-0045）として content と別に渡す。明細は `addVariationNodeSchema`（C4 と内容形状を共有）で
 * 検証し、sortOrder を配列順から導出して `VariationContentInput` へ写す。バリエーション番号は
 * 集約が max+1 で自動採番する（§A.2）ため入力に含めない。version はフォーム由来の楽観ロック
 * トークン（ADR-0039・追加型でも必須）。税率不一致（§8.7）は例外でなく Result のためフォーム
 * エラーで提示し編集を維持する。競合・その他例外は handleCommandError 経由。成功時のみ redirect。
 */
export async function addVariation(
  estimateNumber: string,
  _prevState: unknown,
  formData: FormData
) {
  await verifySession();

  const submission = parseWithZod(formData, { schema: addVariationNodeSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }
  const value = submission.value;

  const dto = await getEstimateDetailQueryFactory().execute({ estimateNumber });
  if (!dto) {
    return submission.reply({ formErrors: ["見積が見つかりません"] });
  }

  const input: AddVariationInput = {
    estimateId: dto.estimateId,
    version: value.version,
    submissionType: value.submissionType,
    content: toVariationContentInputFromNodes(value),
  };

  let result;
  try {
    result = await addVariationCommandFactory().execute(input);
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
 * 得意先改訂（C7・集約内の縦スライス）の Server Action。
 *
 * 改訂先の内容は改訂元からの全複写でドメインが決定するため、入力は改訂元の sourceVariationId と
 * 楽観ロックトークン version のみ（reviseForCustomerSchema）。estimateId は estimateNumber から DTO
 * 解決する。明細・金額の写像は不要（C4 と異なり content を組み立てない）。税率不一致（§8.7）は
 * 例外でなく Result のためフォームエラーで提示しモーダルを維持する（文言は作成・複製と共有）。
 * 競合・その他例外は handleCommandError 経由でフォームエラー化する。成功時は同一見積の詳細へ
 * 改訂先タブ出現済みで戻り、専用フラッシュで結果を伝える（ESTIMATE_REVISED）。
 */
export async function reviseForCustomer(
  estimateNumber: string,
  _prevState: unknown,
  formData: FormData
) {
  await verifySession();

  const submission = parseWithZod(formData, { schema: reviseForCustomerSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }
  const value = submission.value;

  const dto = await getEstimateDetailQueryFactory().execute({ estimateNumber });
  if (!dto) {
    return submission.reply({ formErrors: ["見積が見つかりません"] });
  }

  const input: ReviseForCustomerInput = {
    estimateId: dto.estimateId,
    sourceVariationId: value.sourceVariationId,
    version: value.version,
  };

  let result;
  try {
    result = await reviseForCustomerCommandFactory().execute(input);
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({ formErrors: errorMessage ? [errorMessage] : [] });
  }

  // 税率不一致（§8.7）は改訂されない。両税率を提示してモーダルを維持する（文言は作成・複製と共有）。
  if (result.kind === "taxRateMismatch") {
    return submission.reply({
      formErrors: taxRateMismatchFormErrors(
        result.estimateDateRate.value,
        result.deadlineRate.value
      ),
    });
  }

  revalidatePath(`/estimates/${estimateNumber}`);
  redirect(`/estimates/${estimateNumber}?reason=${REDIRECT_REASON.ESTIMATE_REVISED}`);
}

/**
 * 見積複製（C6・集約またぎ）の Server Action（ADR-0057）。
 *
 * 複製元は estimateNumber から DTO 解決して sourceEstimateId を得る。作成者は認証セッションの
 * employeeId（null は複製不可）。日付は JST 固定パース。税率は見積年月日からマスタ導出し、§8.7
 * 整合チェックと複製を app-shared `checkTaxRateThenDuplicate` に委譲する（コマンドは taxRate を
 * 生値で受けるのみで §8.7 を保証しないため・ADR-0056）。不一致（taxRateMismatch）は例外でなく
 * Result のためフォームエラーで提示しモーダルを維持する。成功時は新採番の見積詳細へ閲覧モードで
 * redirect し、単価クリアをフラッシュで促す（ESTIMATE_DUPLICATED）。redirect は try の外で行う
 * （redirect は例外送出で制御するため・既存アクションと同型）。
 */
export async function duplicateEstimate(
  estimateNumber: string,
  _prevState: unknown,
  formData: FormData
) {
  const session = await verifySession();

  const submission = parseWithZod(formData, { schema: duplicateEstimateSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }
  const value = submission.value;

  const createdBy = session.user.employeeId;
  if (!createdBy) {
    return submission.reply({
      formErrors: [
        "作成者の従業員情報が取得できないため、複製できません。管理者にお問い合わせください。",
      ],
    });
  }

  const dto = await getEstimateDetailQueryFactory().execute({ estimateNumber });
  if (!dto) {
    return submission.reply({ formErrors: ["複製元の見積が見つかりません"] });
  }

  let result;
  try {
    result = await checkTaxRateThenDuplicate(
      {
        sourceEstimateId: dto.estimateId,
        selectedVariationIds: value.selectedVariationIds,
        estimateDate: fromDateInputValue(value.estimateDate),
        deadline: fromDateInputValue(value.deadline),
        createdBy,
        departmentId: value.departmentId,
      },
      checkTaxRateThenDuplicateDepsFactory()
    );
  } catch (error) {
    const errorResult = handleCommandError(error);
    const errorMessage = !errorResult.success && errorResult.error ? errorResult.error : undefined;
    return submission.reply({ formErrors: errorMessage ? [errorMessage] : [] });
  }

  // 税率不一致（§8.7）は複製されない。両税率を提示してモーダルを維持する（文言は作成と共有）。
  if (result.kind === "taxRateMismatch") {
    return submission.reply({
      formErrors: taxRateMismatchFormErrors(
        result.estimateDateRate.value,
        result.deadlineRate.value
      ),
    });
  }

  // 成功: 複製元は不変。新採番の見積詳細へ閲覧モードで遷移し、単価クリアをフラッシュで促す。
  const newEstimateNumber = result.estimate.estimateNumber.value;
  revalidatePath(`/estimates/${newEstimateNumber}`);
  redirect(`/estimates/${newEstimateNumber}?reason=${REDIRECT_REASON.ESTIMATE_DUPLICATED}`);
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
