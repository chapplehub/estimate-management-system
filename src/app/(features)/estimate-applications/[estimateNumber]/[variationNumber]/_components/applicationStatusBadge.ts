import { type VariationApplicationStateBadgeTone as BadgeTone } from "@/app/_components/shared/variationApplicationStateBadge";
import { type ApplicationStatusCode } from "@subdomains/estimate/domain/values/approval/ApplicationStatus";

/**
 * 申請状態（4値・§3.6）→ バッジ色調の写像（見積申請詳細・#574）。
 *
 * 色調の語彙（tone）と `tone→className` は共通 tone 層（`shared/variationApplicationStateBadge`）を
 * 単一ソースとして再利用し、本ファイルは「申請状態 code → tone」の写像だけを持つ。バリエーション
 * 申請状態の重なる4値（`badgeToneOf`）と同じ配色に揃える（同じ状態は同じ色・ADR-0069 の語彙単一化）。
 *
 * `default` の `never` ガードで全 code 網羅をコンパイル時に強制する（VO に値が増えたらここが型エラー）。
 */
export function applicationStatusBadgeToneOf(code: ApplicationStatusCode): BadgeTone {
  switch (code) {
    case "PENDING":
      return "info";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "warning";
    case "WITHDRAWN":
      return "neutral";
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}
