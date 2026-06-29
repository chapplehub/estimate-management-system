/**
 * 共通販売単価 適用期間の状態別操作権限（純粋述語・#473 で実BE接続後の残置ヘルパ）。
 *
 * 時点状態の派生・重複禁止は BE（編集読みモデルの status 算出・集約の不変条件）が担うようになったため、
 * FE 側にはプレゼンテーション関心の `authorityFor`（行ごとの編集／適用終了／削除ボタンの出し分け）だけを
 * 残す。BE の status（`future`/`active`/`expired`）をそのまま受ける（変換層を挟まない・#473）。
 * 用語の正準は CONTEXT.md「価格」節 / use-cases.md §7。
 */

import type { CommonSellingPricePeriodStatus } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceEditDTO";

/** 行の時点状態に応じて何が許されるか（UI のボタン表示）。 */
export type PeriodAuthority = {
  /** 全項目編集可（将来行のみ）。 */
  editable: boolean;
  /** 適用終了＝終了日設定のみ可（現在有効行のみ）。 */
  endDatable: boolean;
  /** 物理削除可（将来行のみ）。 */
  deletable: boolean;
};

/**
 * 時点状態から編集/適用終了/削除の権限を導く（use-cases.md §7 の表に一致）。
 *
 * BE 編集読みモデルの status（`future`/`active`/`expired`）をそのまま受ける（#473・FE 素描画方針＝
 * 変換しない）。現在有効＝`active`、将来＝`future`、失効＝`expired`。
 */
export function authorityFor(status: CommonSellingPricePeriodStatus): PeriodAuthority {
  return {
    editable: status === "future",
    endDatable: status === "active",
    deletable: status === "future",
  };
}
