import { type VariationApplicationStateCode } from "@subdomains/estimate/domain/values/approval/VariationApplicationState";

/**
 * 見積申請一覧画面（/estimate-applications・FE は別 issue）が依存する軽量 read model DTO（CQRS・#571）。
 *
 * 一覧の 1 行 = バリエーション 1 件。対象は「申請または承認免除の記録を持つバリエーション」
 * （＝バリエーション申請状態が NONE 以外）。集約再構築を経ず Prisma を直読みし、状態は書き込みと
 * 共有のドメイン純粋関数（deriveApplicationStatus / VariationApplicationState.reduce /
 * deriveAwaitingStepOrder）で還元して組み立てる（ADR-20260707-b36）。
 *
 * 状態・申請者・申請日時・承認待ち役割は「最新申請（attempt 最大の 1 件）」を出自とする
 * （CONTEXT「最新申請」）。ただし承認不要（EXEMPTED）の行には申請が無く、`applicantName` /
 * `appliedAt` は免除者・免除日時を指す（同じ列が状態の出自を表す・列名は据え置き）。
 */
export type EstimateApplicationSummaryDTO = {
  /** バリエーション ID（行の identity・FE の React key・表示列ではない）。 */
  variationId: string;

  // --- 表示 10 列 ---
  /** 見積番号。 */
  estimateNumber: string;
  /** バリエーション番号（見積内での枝番）。 */
  variationNumber: number;
  /** 得意先名（ADR-0013 のリレーション越し）。 */
  customerName: string;
  /** 納品先名（ADR-0013 のリレーション越し）。 */
  deliveryLocationName: string;
  /** 提出区分（バリエーションの submissionType）。 */
  submissionType: string;
  /** 税込合計金額（バリエーションの finalTotal・永続集計をそのまま読む・ADR-0033）。 */
  finalTotal: number;
  /**
   * 申請状態（バッジ表示用）。`code` は VO 単一ソースの 6 値のうち NONE を除く 5 値（ADR-0069）、
   * `label` は VO が持つ正準文言（重なる 4 値は申請 VO へ委譲・EXEMPTED=承認不要）。
   */
  applicationState: {
    code: VariationApplicationStateCode;
    label: string;
  };
  /**
   * 承認待ち役割名（PENDING の行のみ値を持ち、非 PENDING は null）。承認行の無い最小 stepOrder の
   * 役割（deriveAwaitingStepOrder で導出）を名前解決したもの（ADR-0013）。
   */
  awaitingRoleName: string | null;
  /** 申請者名（最新申請の申請者。EXEMPTED 行は免除者・出自は状態に従う）。 */
  applicantName: string;
  /** 申請日時（最新申請の申請日時。EXEMPTED 行は免除日時・出自は状態に従う）。 */
  appliedAt: Date;
};
