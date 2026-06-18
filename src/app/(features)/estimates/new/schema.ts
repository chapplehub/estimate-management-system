import { z } from "zod";
import { dateInput } from "../[estimateNumber]/schema";
import { nodesField } from "../[estimateNumber]/variationSchema";

/**
 * 見積新規作成フォーム（C1）のバリデーションスキーマ。
 *
 * 編集系（updateEstimateHeaderSchema / addVariationNodeSchema）と原子を共有しつつ、作成固有の
 * 差分を持つ:
 * - `version` を持たない（新規採番のため楽観ロックトークン不要・ADR-0039）
 * - `taxRate` を持たない（見積年月日からマスタ導出し read-only・§A.1 / ADR-0056）
 * - `estimateType` を submit に持つ（編集は estimate から固定だが作成は選択する）
 * - 初期バリ1件分の `submissionType`（不変属性・ADR-0045）と内容（nodes/全体値引/メモ）を含む
 *
 * 日付は "yyyy-mm-dd" のまま受け Server Action で JST 固定パースする（z.coerce.date() は不可）。
 * 区分別サブタイプの必須性は estimateType を submit に持つ作成側でのみ schema で担保できるため、
 * superRefine で条件必須化する（編集はアクション側＋ドメイン VO 担保からの意図的乖離）。
 */
export const createEstimateSchema = z
  .object({
    estimateType: z.enum(["NEW", "REPAIR", "AFTER_REPAIR"], {
      message: "見積区分を選択してください",
    }),
    estimateDate: dateInput,
    deadline: dateInput,
    customerId: z.string().min(1, "得意先を選択してください"),
    deliveryLocationId: z.string().min(1, "納品先を選択してください"),
    departmentId: z.string().min(1, "部署を選択してください"),
    taxRoundingType: z.enum(["ROUND_DOWN", "ROUND_UP", "ROUND"]),

    // 初期バリエーション（1件）。提出区分は不変属性（ADR-0045）。
    submissionType: z.enum(["CUSTOMER", "DELIVERY_LOCATION"], {
      message: "提出区分を選択してください",
    }),
    overallDiscount: z.coerce.number().min(0, "全体値引は0以上で入力してください"),
    customerMemo: z.string().optional(),
    internalMemo: z.string().optional(),
    nodes: nodesField,

    // 修理情報（REPAIR）。表示は区分依存のため optional で受け、superRefine で必須化する。
    repairTargetProductId: z.string().optional(),
    repairFaultDescription: z.string().optional(),
    repairScheduledRepairDate: z.string().optional(),

    // 事後修理情報（AFTER_REPAIR）。同上。
    afterRepairTargetProductId: z.string().optional(),
    afterRepairFaultDescription: z.string().optional(),
    afterRepairActualRepairDate: z.string().optional(),
    afterRepairEmergencyReason: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    /** 空文字／undefined を「未入力」として、指定パスへ必須エラーを付与する。 */
    const requireField = (field: string, message: string) => {
      const v = value[field as keyof typeof value];
      if (typeof v !== "string" || v.trim() === "") {
        ctx.addIssue({ code: "custom", message, path: [field] });
      }
    };

    if (value.estimateType === "REPAIR") {
      requireField("repairTargetProductId", "修理対象製品を選択してください");
      requireField("repairFaultDescription", "故障内容を入力してください");
      requireField("repairScheduledRepairDate", "修理予定日を入力してください");
    }

    if (value.estimateType === "AFTER_REPAIR") {
      requireField("afterRepairTargetProductId", "修理対象製品を選択してください");
      requireField("afterRepairFaultDescription", "故障内容を入力してください");
      requireField("afterRepairActualRepairDate", "修理実施日を入力してください");
      requireField("afterRepairEmergencyReason", "緊急理由を入力してください");
    }
  });

export type CreateEstimateFormInput = z.infer<typeof createEstimateSchema>;
