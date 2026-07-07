import {
  VariationApplicationState,
  type VariationApplicationStateCode,
} from "@subdomains/estimate/domain/values/approval/VariationApplicationState";

/**
 * 検索フィルタ用の「バリエーション申請状態」選択肢（見積申請一覧・#572）。
 *
 * 行を伴わない検索フィルタは行 DTO の `applicationState.label` を使えないため、状態の
 * code+label の列挙をここで供給する。label の単一ソースはドメイン VO
 * （{@link VariationApplicationState}）であり、本定数も VO の `.label` から採るのでドリフトしない
 * （ADR-0069）。presentation は application 境界のこの定数を import し、domain へ直接手を伸ばさない
 * （DDD 層規則。application→domain 依存は許容）。
 *
 * NONE（未申請）は本一覧の行に現れず検索語彙として意味を持たないため除外し、承認者の
 * ワークリスト用途を優先して PENDING を先頭に並べる（残りは REJECTED/WITHDRAWN/APPROVED/EXEMPTED）。
 */
export const SEARCHABLE_VARIATION_APPLICATION_STATE_OPTIONS: ReadonlyArray<{
  code: VariationApplicationStateCode;
  label: string;
}> = [
  VariationApplicationState.PENDING,
  VariationApplicationState.REJECTED,
  VariationApplicationState.WITHDRAWN,
  VariationApplicationState.APPROVED,
  VariationApplicationState.EXEMPTED,
].map((state) => ({ code: state.code, label: state.label }));
