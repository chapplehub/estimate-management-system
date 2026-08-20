import {
  type ApplicationDetailSummaryView,
  type ApplicationView,
  type ExemptionView,
} from "./dto/EstimateApplicationDetailDTO";

/**
 * 操作可否合成に使う操作者非依存の生事実（ADR-20260707-ae2）。
 *
 * query service が Prisma 直読みで還元して返し、app 層 Query が操作者を受けて `operations` を組み立てる。
 * 表示ビューには現れない（`canApprove` などの合成材料に徹する）。免除・非 PENDING の枝では
 * `isPending=false` かつ標的系は null になる。
 */
export type ApplicationOperationFacts = {
  /** 最新申請が導出上 PENDING（承認待ち）か。免除・非申請は false（操作可否の共通ゲート）。 */
  isPending: boolean;
  /** 最新申請の申請者 ID（canWithdraw の本人性判定）。免除・非申請は null。 */
  applicantEmployeeId: string | null;
  /** 承認待ちステップの役割 ID（canApprove/canReject の hasMember 判定）。非 PENDING は null。 */
  awaitingRoleId: string | null;
  /** 最新申請 ID（承認/差戻/取下コマンドの標的）。免除・非申請は null。 */
  latestApplicationId: string | null;
  /** 承認待ちステップ ID（承認/差戻コマンドの標的）。非 PENDING は null。 */
  awaitingStepId: string | null;
  /** 最新申請の version（コマンドの expectedVersion トークン・ADR-0039）。免除・非申請は null。 */
  expectedVersion: number | null;
};

/**
 * query service が返す操作者非依存の projection（ADR-20260707-ae2）。
 *
 * 表示ビュー（`summary` と判別ユニオンの枝）＋操作可否合成用の生事実（`operationFacts`）を運ぶ。
 * app 層 Query がこれを受け取り、operator から `operations` を合成して最終
 * {@link EstimateApplicationDetailDTO} に整形する。
 */
export type EstimateApplicationDetailProjection = {
  summary: ApplicationDetailSummaryView;
  operationFacts: ApplicationOperationFacts;
} & (
  | { kind: "APPLICATIONS"; latest: ApplicationView; past: ApplicationView[] }
  | { kind: "EXEMPTED"; exemption: ExemptionView }
);

/**
 * 見積申請詳細クエリサービスインターフェース（CQRS read model の境界・#573）。
 *
 * アプリケーション層が依存する読み取りポート。実装
 * （PrismaEstimateApplicationDetailQueryService）は infrastructure 層で Prisma を直読みし、
 * 状態は書き込みと共有のドメイン純粋関数（deriveApplicationStatus / deriveApprovalStepStatus /
 * deriveAwaitingStepOrder）で還元して projection を組み立てる。操作者は知らない
 * （操作可否の合成は app 層・ADR-20260707-ae2）。
 */
export interface EstimateApplicationDetailQueryService {
  /**
   * 見積番号＋バリエーション番号で申請詳細の projection を返す。
   *
   * 対象は申請または承認免除の記録を持つバリエーション。見積番号なし／バリエーション番号なし／
   * 申請も免除も無い、のいずれも `null`（NotFound・一覧の母集合と整合）。
   */
  findDetail(
    estimateNumber: string,
    variationNumber: number
  ): Promise<EstimateApplicationDetailProjection | null>;
}
