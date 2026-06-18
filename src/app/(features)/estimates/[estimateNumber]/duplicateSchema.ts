import { z } from "zod";
import { dateInput } from "./schema";

/**
 * 見積複製フォーム（C6 / ADR-0057）のバリデーションスキーマ。
 *
 * 複製は複製元から見積区分・得意先・納品先・税端数区分・提出区分を継承するため、利用者の入力面は
 * 「複製するバリエーションの選択＋見積日・締切日・部署」のみと小さい（§5.3）。作成（createEstimateSchema）
 * と異なり初期バリ内容を入力させず、複製先の見積単価は遷移先の C4 編集で再入力する。
 *
 * - selectedVariationIds: チェックボックス群（同名複数）で配列化し ≥1 必須（空見積不可・ADR-0042）。
 *   送出順＝複製元の並び順を維持し、複製先で連番に振り直す（順序は UI 側で複製元順にソート）。
 * - estimateDate / deadline: "yyyy-mm-dd" のまま受け Server Action で JST 固定パース（dateInput 共有）。
 * - version は持たない（新規採番のため楽観ロックトークン不要・ADR-0039）。
 * - taxRate は持たない（見積日からマスタ導出し read-only・checkTaxRateThenDuplicate が所有・ADR-0056）。
 */
export const duplicateEstimateSchema = z.object({
  selectedVariationIds: z
    .array(z.string().min(1))
    .min(1, "複製するバリエーションを1つ以上選択してください"),
  estimateDate: dateInput,
  deadline: dateInput,
  departmentId: z.string().min(1, "部署を選択してください"),
});

export type DuplicateEstimateFormInput = z.infer<typeof duplicateEstimateSchema>;
