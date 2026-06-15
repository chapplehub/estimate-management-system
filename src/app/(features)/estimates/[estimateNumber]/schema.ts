import { z } from "zod";

/**
 * 見積ヘッダー編集フォーム（S3 / C2）のバリデーションスキーマ。
 *
 * 日付は input[type=date] の "yyyy-mm-dd" 文字列のまま受け、Server Action で JST 固定
 * パース（fromDateInputValue）する。z.coerce.date() は UTC 解釈で暦日がずれるため使わない。
 * taxRate は read-only（自由入力不可・C2 入力からも除外）のためスキーマに含めない。
 * 修理情報は REPAIR / AFTER_REPAIR のときだけフォームに現れるため optional とし、必須性は
 * estimateType を知る Server Action 側で担保する（単一フォーム・条件表示）。
 */
const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入力してください");

export const updateEstimateHeaderSchema = z.object({
  /** 楽観ロックトークン（ADR-0039）。編集画面表示時の値を hidden で往復させる。 */
  version: z.coerce.number().int(),
  estimateDate: dateInput,
  deadline: dateInput,
  customerId: z.string().min(1, "得意先を選択してください"),
  deliveryLocationId: z.string().min(1, "納品先を選択してください"),
  departmentId: z.string().min(1, "部署を選択してください"),
  taxRoundingType: z.enum(["ROUND_DOWN", "ROUND_UP", "ROUND"]),

  // 修理情報（REPAIR）
  repairTargetProductId: z.string().optional(),
  repairFaultDescription: z.string().optional(),
  repairScheduledRepairDate: z.string().optional(),

  // 事後修理情報（AFTER_REPAIR）
  afterRepairTargetProductId: z.string().optional(),
  afterRepairFaultDescription: z.string().optional(),
  afterRepairActualRepairDate: z.string().optional(),
  afterRepairEmergencyReason: z.string().optional(),
});

export type UpdateEstimateHeaderFormInput = z.infer<typeof updateEstimateHeaderSchema>;
