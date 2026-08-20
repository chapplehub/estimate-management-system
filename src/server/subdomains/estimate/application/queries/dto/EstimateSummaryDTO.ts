/**
 * 見積一覧画面（フロントは別 issue）が依存する軽量 read model DTO（CQRS）。
 *
 * 一覧の 1 行 = 見積 1 件（Estimate 単位）。金額・状態は「代表バリエーション」
 * （ACTIVE 優先の最小 variationNumber → 無ければ全体の最小・ADR-0051）の値を載せる。
 * 詳細用 EstimateDetailDTO は全リレーションを eager load して重いので一覧には流用しない。
 */
export type EstimateSummaryDTO = {
  estimateId: string;
  estimateNumber: string;
  /** 見積区分（"NEW" | "REPAIR" | "AFTER_REPAIR"）。 */
  estimateType: string;
  estimateDate: Date;
  deadline: Date;

  // ADR-0013: リレーション先の名前・コードを含める（FK の ID は一覧では持たない）
  customerCode: string;
  customerName: string;
  /**
   * 納品先名（一覧「納品先」列・Q1-b）。表示は名前のみのため code は持たない
   * （Q1 の得意先コード非表示方針と一貫・YAGNI）。名前解決は ADR-0013 のリレーション越し。
   */
  deliveryLocationName: string;
  /** 作成者（見積担当者）の社員コード（Employee.employeeCd）。 */
  creatorCode: string;
  creatorName: string;

  /** 代表バリエーションの最終合計金額（永続集計・ADR-0033 / ADR-0051）。 */
  finalTotal: number;
  /** 代表バリエーションの有効/無効（"ACTIVE" | "INACTIVE"・ADR-0051）。 */
  activeStatus: string;
  /**
   * 表示ステータス（進行状態の導出値・設計書 §1.3）。本 issue では常に null（場所だけ予約）。
   * 共通申請テーブル（ADR-0001）・Order 系が未実装のため導出しない。将来の承認/受注 issue で実値化。
   */
  displayStatus: EstimateDisplayStatus | null;
};

/**
 * 表示ステータス（設計書 §1.3 の導出値）。申請状態と受注状態の合成で 1 値に定まる。
 * 単一カラムを持たない導出概念（CONTEXT.md「表示ステータス」）。DTO 契約として union で表現する。
 */
export type EstimateDisplayStatus =
  | "作成中"
  | "申請中"
  | "差戻"
  | "取下"
  | "承認済"
  | "受注作成済"
  | "受注確定済"
  | "受注取消済";
