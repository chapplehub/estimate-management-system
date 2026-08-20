import { VariationApplicationState } from "@subdomains/estimate/domain/values/approval/VariationApplicationState";
import type { EstimateApplicationSearchCriteria } from "./dto/EstimateApplicationSearchCriteria";

/**
 * 還元済みの見積申請一覧行（Prisma 直読み＋ドメイン共有関数での還元後の中間表現・#571）。
 *
 * infra が最小射影を materialize し、`VariationApplicationState.reduce`／`deriveAwaitingStepOrder`
 * で状態・承認待ちを畳んだ結果を、Prisma 非依存の素の値で表す。導出条件のフィルタ・固定ソート・
 * limit を純粋関数で回すための入力型（ADR-20260707-b36）。DTO 整形（state VO → code+label）は
 * infra 側の最終段が担う。
 *
 * 状態・申請者・申請日時・承認待ち役割は「最新申請」を出自とする。EXEMPTED 行は申請が無く、
 * `applicantName`/`appliedAt` は免除者・免除日時、`awaitingRole*` は null。
 */
export type ReducedApplicationRow = {
  variationId: string;
  estimateNumber: string;
  variationNumber: number;
  customerName: string;
  deliveryLocationName: string;
  submissionType: string;
  finalTotal: number;
  /** 最新申請スコープで還元したバリエーション申請状態（NONE 以外）。 */
  state: VariationApplicationState;
  /** 承認待ち役割の roleId（PENDING の行のみ・非 PENDING は null）。フィルタ用。 */
  awaitingRoleId: string | null;
  /** 承認待ち役割名（PENDING の行のみ・非 PENDING は null）。表示用。 */
  awaitingRoleName: string | null;
  applicantName: string;
  appliedAt: Date;
};

/**
 * 導出条件（最新申請スコープでアプリ層が絞る条件・ADR-20260707-b36）。
 * 検索条件のうち不変事実（見積番号・得意先名・納品先名・includeInactive）は SQL で絞り済みのため、
 * ここには現れない。
 */
export type DerivedSearchConditions = Pick<
  EstimateApplicationSearchCriteria,
  "state" | "applicantName" | "awaitingRoleId" | "appliedFrom" | "appliedTo"
>;

/**
 * 還元済み行に導出条件のフィルタを適用し、固定順で安定ソートし、先頭 `limit` 件を切り出す純粋関数
 * （ADR-20260707-b36）。Prisma 非依存で、DB 無しの単体テストで網羅する。
 *
 * ソート順は固定: 申請日時降順 → 見積番号昇順 → バリエーション番号昇順（決定的安定化）。
 * `limit` は与えられた件数をそのまま先頭から切り出す（「+1 を渡すか」は呼び出し側の関心）。
 */
export function selectApplicationRows(
  rows: ReadonlyArray<ReducedApplicationRow>,
  conditions: DerivedSearchConditions,
  limit?: number
): ReducedApplicationRow[] {
  const filtered = rows.filter((r) => matches(r, conditions));
  const sorted = filtered.sort(compareRows);
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

/** 全導出条件を AND で判定する（各条件は未指定なら絞らない）。 */
function matches(r: ReducedApplicationRow, c: DerivedSearchConditions): boolean {
  if (c.state !== undefined && c.state.length > 0 && !c.state.includes(r.state.code)) {
    return false;
  }
  if (c.applicantName !== undefined && !includesInsensitive(r.applicantName, c.applicantName)) {
    return false;
  }
  // 承認待ち役割を持たない行（非 PENDING）は awaitingRoleId=null のため等値で自然に外れる
  // （状態=承認済 かつ 承認待ち役割指定 のような矛盾組合せは AND で素直に空・ADR-20260707-b36）。
  if (c.awaitingRoleId !== undefined && r.awaitingRoleId !== c.awaitingRoleId) {
    return false;
  }
  // 申請日時の範囲は境界含み（免除行は免除日時が出自）。
  if (c.appliedFrom !== undefined && r.appliedAt.getTime() < c.appliedFrom.getTime()) {
    return false;
  }
  if (c.appliedTo !== undefined && r.appliedAt.getTime() > c.appliedTo.getTime()) {
    return false;
  }
  return true;
}

/** 大文字小文字を無視した部分一致（SQL の contains mode:"insensitive" と同義）。 */
function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** 固定ソート: 申請日時降順 → 見積番号昇順 → バリエーション番号昇順。 */
function compareRows(a: ReducedApplicationRow, b: ReducedApplicationRow): number {
  const byApplied = b.appliedAt.getTime() - a.appliedAt.getTime();
  if (byApplied !== 0) return byApplied;
  const byNumber = a.estimateNumber.localeCompare(b.estimateNumber);
  if (byNumber !== 0) return byNumber;
  return a.variationNumber - b.variationNumber;
}
