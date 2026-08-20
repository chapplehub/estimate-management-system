import { Badge } from "@/app/_components/shadcnui/badge";
import { badgeToneClassName } from "@/app/_components/shared/variationApplicationStateBadge";
import type { UnitPriceDivergence } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { unitPriceDivergenceBadgeView } from "./unitPriceDivergenceBadge";

/**
 * 明細行の単価乖離・解決不能バッジ（#593）。見積詳細（LineTable）と C4 編集（LineEditTable）で共有する。
 *
 * バッジを出さない状態（未合成／乖離なし）は何も描かない。文言は固定、色は warning 固定で、現在値・
 * 符号つき差額は `title`（ツールチップ）に載せる（方向で色分けしない・ADR-20260710-fg7）。
 */
export function UnitPriceDivergenceBadge({ divergence }: { divergence?: UnitPriceDivergence }) {
  const view = unitPriceDivergenceBadgeView(divergence);
  if (view === null) {
    return null;
  }
  return (
    <Badge
      variant="outline"
      className={`ml-1 align-middle ${badgeToneClassName(view.tone)}`}
      title={view.tooltip}
    >
      {view.label}
    </Badge>
  );
}
