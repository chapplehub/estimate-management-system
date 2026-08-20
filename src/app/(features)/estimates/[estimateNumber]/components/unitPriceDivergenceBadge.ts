import type { VariationApplicationStateBadgeTone } from "@/app/_components/shared/variationApplicationStateBadge";
import type { UnitPriceDivergence } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { formatYen } from "../../_shared/labels";

/** 行内バッジの表示モデル（固定文言・警告トーン・ツールチップ）。 */
export type UnitPriceDivergenceBadgeView = {
  /** 固定文言（「単価乖離」/「解決不能」）。CONTEXT 正準語。 */
  label: string;
  /** 色調は warning 固定（方向で色分けしない）。 */
  tone: VariationApplicationStateBadgeTone;
  /** `title` 属性に載せる補足（現在値・符号つき差額／解決不能の説明）。 */
  tooltip: string;
};

/**
 * 単価乖離・解決不能（→CONTEXT・#593）を行内バッジの表示モデルへ写す。
 *
 * バッジを出さない状態（未合成＝undefined／乖離なし＝NONE）は `null` を返す。方向（値の増減）で
 * 色を変えず warning 固定とし、現在の解決値と符号つき差額はツールチップに載せる（ADR-20260710-fg7）。
 * kind の網羅は `never` ガードでコンパイル時に強制する（状態が増えたら pre-push の tsc が落とす）。
 */
export function unitPriceDivergenceBadgeView(
  divergence: UnitPriceDivergence | undefined
): UnitPriceDivergenceBadgeView | null {
  if (divergence === undefined) {
    return null;
  }
  switch (divergence.kind) {
    case "NONE":
      return null;
    case "DIVERGENT": {
      // DIVERGENT は固定値≠再解決値ゆえ差額は非0。プラス＝現在マスタの方が高い。
      const sign = divergence.difference > 0 ? "+" : "−";
      return {
        label: "単価乖離",
        tone: "warning",
        tooltip: `現在の単価 ${formatYen(divergence.currentUnitPrice)}（差額 ${sign}${formatYen(
          Math.abs(divergence.difference)
        )}）`,
      };
    }
    case "UNRESOLVABLE":
      return {
        label: "解決不能",
        tone: "warning",
        tooltip: "現在のマスタに見積年月日時点の有効な販売単価がありません",
      };
    default: {
      const _exhaustive: never = divergence;
      return _exhaustive;
    }
  }
}
