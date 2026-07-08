import { type ApplicationStatusCode } from "@subdomains/estimate/domain/values/approval/ApplicationStatus";
import { type ApprovalStepStatusCode } from "@subdomains/estimate/domain/values/approval/ApprovalStepStatus";
import { type EstimateExemptionReasonCode } from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { type VariationApplicationStateCode } from "@subdomains/estimate/domain/values/approval/VariationApplicationState";

/**
 * 見積申請詳細画面（/estimate-applications/[estimateNumber]/[variationNumber]・FE は別 issue）が
 * 依存する読み取り DTO（CQRS read model・#573）。
 *
 * あるバリエーションの申請の全容を一括供給する。判別ユニオン（{@link EstimateApplicationDetailDTO}）
 * で「申請あり（APPLICATIONS）」と「承認免除（EXEMPTED）」を分け、`summary`（バリエーション要約）と
 * `operations`（操作可否）はユニオン外に常設する。状態語彙（code+label）はドメイン VO を単一ソースと
 * し（ADR-0069）、DTO は VO の code 型を再輸出して独自の文字列ユニオンを定義しない。
 *
 * 操作可否（`operations`）の合成は app 層 Query が操作者を受けて行い、Prisma query service は
 * 操作者非依存の読み取りに保つ（ADR-20260707-ae2）。
 */

/** バリエーション要約（ユニオン外・常設）。一覧の 1 行と同じ不変事実＋バリエーション申請状態。 */
export type ApplicationDetailSummaryView = {
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
   * バリエーション申請状態（バッジ表示用）。`code` は VO 単一ソースの 6 値（ADR-0069）、
   * `label` は VO が持つ正準文言。詳細は申請の有無に関わらず開けるため NONE も取り得る。
   */
  applicationState: {
    code: VariationApplicationStateCode;
    label: string;
  };
};

/**
 * 承認ステップ 1 件（flat・§3.6）。均一テーブル UI に合わせ、承認者/差戻者を `actorName` に畳み込み、
 * `status` の code で状態を判別する（ステップ単位ユニオンは採らない）。
 */
export type ApprovalStepView = {
  /** 1 始まりの順序（stepOrder）。 */
  order: number;
  /** 承認対象役割の名称（例: 営業一課長・ADR-0013）。 */
  roleName: string;
  /** ステップの導出状態（§3.6・code は VO 単一ソース）。 */
  status: {
    code: ApprovalStepStatusCode;
    label: string;
  };
  /** 承認者/差戻者の氏名（APPROVED は承認者・REJECTED は差戻者・未決は null）。 */
  actorName: string | null;
  /** 決定の発生日時（APPROVED/REJECTED のみ・未決は null）。 */
  decidedAt: Date | null;
  /** 差戻コメント（REJECTED のみ・それ以外は null）。 */
  rejectionComment: string | null;
};

/**
 * 申請 1 件のビュー（最新・過去で共通）。バリエーション申請状態とは別概念の、自前の申請状態
 * （§3.6・{@link ApplicationStatusCode}）を持つ。
 */
export type ApplicationView = {
  /** 申請 ID（行の identity）。 */
  applicationId: string;
  /** 申請回数（同一バリエーションへの通番・差戻再申請で +1・§3.2）。 */
  attempt: number;
  /** 申請者名。 */
  applicantName: string;
  /** 申請日時。 */
  appliedAt: Date;
  /** 最終承認役職名（金額から算出・ADR-0055）。 */
  finalApprovalPositionName: string;
  /** 申請の導出状態（§3.6・code は VO 単一ソース）。 */
  status: {
    code: ApplicationStatusCode;
    label: string;
  };
  /** 承認ステップ列（stepOrder 昇順）。 */
  steps: ApprovalStepView[];
  /** 取下記録（WITHDRAWN の申請のみ・それ以外は null）。 */
  withdrawal: {
    withdrawnByName: string;
    withdrawnAt: Date;
  } | null;
};

/** 免除記録（EXEMPTED 枝の末端・§3.1・高々 1 件・ADR-0054）。 */
export type ExemptionView = {
  /** 免除理由（code は VO 単一ソース・ADR-0069）。 */
  reason: {
    code: EstimateExemptionReasonCode;
    label: string;
  };
  /** 免除実施者の氏名。 */
  exemptedByName: string;
  /** 免除日時。 */
  exemptedAt: Date;
};

/**
 * 操作可否＋コマンド標的（ユニオン外・常設）。3 フラグは app 層 Query が操作者を受けて合成する
 * （ADR-20260707-ae2）。「状態＝申請中」を共通ゲートに、免除・非 PENDING では全 false・標的 null。
 */
export type ApplicationOperationsView = {
  /** 承認可否（申請中 かつ 操作者が承認待ちステップの役割メンバー）。 */
  canApprove: boolean;
  /** 差戻可否（canApprove と同一述語）。 */
  canReject: boolean;
  /** 取下可否（申請中 かつ 操作者が申請者本人）。 */
  canWithdraw: boolean;
  /** 承認/差戻/取下コマンドの対象申請 ID（操作不可時 null）。 */
  latestApplicationId: string | null;
  /** 承認/差戻コマンドの対象ステップ ID（承認待ちステップ・操作不可時 null）。 */
  awaitingStepId: string | null;
  /** 楽観ロックトークン（コマンドの expectedVersion・操作不可時 null）。 */
  expectedVersion: number | null;
};

/**
 * 見積申請詳細の読み取り DTO（判別ユニオン）。
 *
 * - `APPLICATIONS`: 申請ありの枝。`latest`（最新 attempt）と `past`（attempt 降順の過去履歴）を分離。
 * - `EXEMPTED`: 承認免除の枝。`exemption` のみ。
 *
 * `summary` と `operations` は枝に依らず常設する。
 */
export type EstimateApplicationDetailDTO = {
  summary: ApplicationDetailSummaryView;
  operations: ApplicationOperationsView;
} & (
  | { kind: "APPLICATIONS"; latest: ApplicationView; past: ApplicationView[] }
  | { kind: "EXEMPTED"; exemption: ExemptionView }
);
