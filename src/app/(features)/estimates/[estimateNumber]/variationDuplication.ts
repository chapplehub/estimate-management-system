import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { fromVariationLines, type WorkingNode } from "./variationLines";

/**
 * 複製元バリエーション（読み取り DTO）から作成フォーム（C3）の初期値を組む純関数。
 *
 * 明細は `fromVariationLines` で作業ノードへ写す（改訂列は WorkingLine 型に存在せず構造的に
 * ドロップ、セット群はスナップショットのまま引き継ぐ）。提出区分・全体値引・メモは複製元の値を
 * 初期値に運ぶ。複製元を変更しない読み取り写像（無効バリも複製元にできる）。
 */
export type VariationCreateInitialValues = {
  /** 複製元から引き継ぐ提出区分（複製は変更不可・新規追加は選択）。 */
  submissionType: string;
  nodes: WorkingNode[];
  overallDiscount: number;
  customerMemo: string;
  internalMemo: string;
};

export function toCreateInitialValuesFromVariation(
  source: VariationDTO
): VariationCreateInitialValues {
  return {
    submissionType: source.submissionType,
    nodes: fromVariationLines(source.lines),
    overallDiscount: source.overallDiscount,
    customerMemo: source.customerMemo,
    internalMemo: source.internalMemo,
  };
}
