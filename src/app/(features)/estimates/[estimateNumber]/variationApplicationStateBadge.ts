import type {
  VariationApplicationStateCode,
  VariationApplicationStateDTO,
} from "@subdomains/estimate/application/queries/dto/VariationApplicationStateDTO";

/**
 * バリエーション申請状態バッジの消費（見積詳細画面 S2・#493・ADR-0069）
 *
 * FE が BE の読み取り DTO を**直 type-import**で消費する契約点。BE 側の6値ドメイン VO
 * （`VariationApplicationState`）を単一ソースとする `VariationApplicationStateCode` を網羅 switch し、
 * `default` の `never` ガードで**コンパイル時に**全 code 網羅を強制する（VO に値が増えたら
 * ここが型エラーになり、pre-push の `tsc --noEmit` が gate として落とす）。
 *
 * 本ファイルは実行時アサートを持たない型検査専用の契約スタブ。バッジ表示・申請ボタンの
 * 実 UI 実装は FE 分担の別 issue で本ヘルパーを土台に肉付けする（ミラー型を作らない・ADR-0069）。
 */

/** バッジの色調（申請状態の視覚表現。実配色は FE issue で確定する）。 */
export type VariationApplicationStateBadgeTone = "neutral" | "info" | "success" | "warning";

/** 申請状態 code をバッジ色調へ写す。全6 code を網羅し、未知値は never で弾く。 */
export function badgeToneOf(
  code: VariationApplicationStateCode
): VariationApplicationStateBadgeTone {
  switch (code) {
    case "NONE":
      return "neutral";
    case "PENDING":
      return "info";
    case "APPROVED":
      return "success";
    case "EXEMPTED":
      return "success";
    case "REJECTED":
      return "warning";
    case "WITHDRAWN":
      return "neutral";
    default: {
      // 網羅漏れ（VO に code が増えた等）をコンパイル時に検出する（ADR-0069）。
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

/** DTO の全フィールド（variationId / applicationState.code / label / canApply）を読む消費例。 */
export type VariationApplicationStateBadge = {
  variationId: string;
  tone: VariationApplicationStateBadgeTone;
  label: string;
  /** 申請ボタンの活性可否（DTO の canApply をそのまま反映）。 */
  applyEnabled: boolean;
};

/** DTO 1件をバッジ表示モデルへ写す（FE 消費の代表経路）。 */
export function toVariationApplicationStateBadge(
  dto: VariationApplicationStateDTO
): VariationApplicationStateBadge {
  return {
    variationId: dto.variationId,
    tone: badgeToneOf(dto.applicationState.code),
    label: dto.applicationState.label,
    applyEnabled: dto.canApply,
  };
}
