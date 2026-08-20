/**
 * 適用期間 行の状態別操作権限（純粋述語・集約非依存）。
 *
 * 時点状態の派生・重複禁止は BE（編集読みモデルの status 算出・集約の不変条件）が担うため、
 * FE 側にはプレゼンテーション関心の `authorityFor`（行ごとの編集／改定／適用終了／削除ボタンの
 * 出し分け）だけを残す。BE の status（`future`/`active`/`expired`）をそのまま受ける（変換層を挟まない）。
 *
 * 共通売単価（#473）・原価（#503）・得意先別販売単価（#513）の各編集読みモデルが同じ status を持つため、
 * 集約 DTO へ依存させず中立型 `PeriodStatus` を入力に取る（(features)/_shared 昇格・#503）。
 * 純関数のため、集約間で操作権限ルールが将来分岐したらその時点でフォークすれば十分。
 * 用語の正準は CONTEXT.md「価格」節 / use-cases.md §7。
 */

/** 期間行の時点状態（参照日＝今日 を基準にした行の位置づけ）。各集約 DTO の status が構造的に一致する。 */
export type PeriodStatus = "future" | "active" | "expired";

/** 行の時点状態に応じて何が許されるか（UI のボタン表示）。 */
export type PeriodAuthority = {
  /** 全項目編集可（将来行のみ）。 */
  editable: boolean;
  /** 適用終了＝終了日設定のみ可（現在有効行のみ）。 */
  endDatable: boolean;
  /** 物理削除可（将来行のみ）。 */
  deletable: boolean;
  /** 単価改定（適用終了＋新規追加の合成）可（現在有効行のみ）。 */
  revisable: boolean;
};

/**
 * 時点状態から編集/改定/適用終了/削除の権限を導く（use-cases.md §7 の表に一致）。
 *
 * BE 編集読みモデルの status をそのまま受ける（FE 素描画方針＝変換しない）。
 * 現在有効＝`active`、将来＝`future`、失効＝`expired`。
 */
export function authorityFor(status: PeriodStatus): PeriodAuthority {
  return {
    editable: status === "future",
    endDatable: status === "active",
    deletable: status === "future",
    revisable: status === "active",
  };
}
