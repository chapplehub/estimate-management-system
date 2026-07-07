import { type VariationApplicationStateCode } from "@subdomains/estimate/domain/values/approval/VariationApplicationState";

/**
 * バリエーション申請状態の code 集合（6値）を境界へ再輸出する（ADR-0069）。
 *
 * 単一ソースはドメイン VO（{@link VariationApplicationState}）。FE はこの application 境界の
 * ファイルから検索条件型と code 型を直 type-import で消費し、ドメイン層へ直接手を伸ばさない
 * （ミラー型を作らない・ADR-0069）。検索対象は NONE を除く 5 値（PENDING/REJECTED/
 * WITHDRAWN/APPROVED/EXEMPTED）で、NONE（未申請）は本一覧の行に現れないため検索語彙として
 * 意味を持たない（{@link EstimateApplicationSearchCriteria.state} の docstring 参照）。
 */
export type { VariationApplicationStateCode };

/**
 * 見積申請一覧の検索条件（#571・ADR-20260707-b36）。各フィールドは undefined のとき絞り込まない
 * （指定分のみ AND 合成。フィールド内は state のみ OR）。
 *
 * 条件は 2 種類に割れる（ADR-20260707-b36）。**不変事実**（estimateNumber/customerName/
 * deliveryLocationName/includeInactive）は Prisma の where で候補を絞る。**導出条件**
 * （state/applicantName/awaitingRoleId/appliedFrom/appliedTo）は「最新申請（attempt 最大）」
 * スコープの導出値で、SQL で絞ると §3.6 の状態導出を二重実装してドリフトするため、還元後の行に
 * 対しアプリ層の純粋関数で絞る。
 */
export type EstimateApplicationSearchCriteria = {
  /** 見積番号での部分一致検索（contains・大文字小文字無視・不変事実）。 */
  estimateNumber?: string;
  /** 得意先名での部分一致検索（customer.name の contains・ADR-0013 のリレーション越し・不変事実）。 */
  customerName?: string;
  /** 納品先名での部分一致検索（deliveryLocation.name の contains・ADR-0013 越し・不変事実）。 */
  deliveryLocationName?: string;
  /**
   * 申請状態フィルタ（複数選択・フィールド内 OR）。指定した code のいずれかに一致する行を残す。
   * 対象は最新申請スコープの導出状態で、NONE を除く 5 値が意味を持つ（NONE は行に現れない）。
   * 導出値のためアプリ層で絞る（ADR-20260707-b36）。
   */
  state?: VariationApplicationStateCode[];
  /**
   * 申請者名での部分一致検索（導出条件）。行の「申請者」列の出自——申請行なら最新申請の申請者、
   * 免除行なら免除者——に対して一律に効く（CONTEXT「最新申請」）。
   */
  applicantName?: string;
  /**
   * 承認待ち役割の絞り込み（roleId 等値・導出条件）。承認待ち役割は PENDING の行のみが持つため、
   * 非 PENDING 行はこの条件にヒットしない（矛盾組合せは AND で素直に空・ADR-20260707-b36）。
   */
  awaitingRoleId?: string;
  /** 申請日時の下限（この日時以降・導出条件）。免除行は免除日時が出自。appliedFrom ≤ appliedTo。 */
  appliedFrom?: Date;
  /** 申請日時の上限（この日時以前・導出条件）。免除行は免除日時が出自。 */
  appliedTo?: Date;
  /**
   * 無効（INACTIVE）バリエーションを含めるか（不変事実・既定 false）。
   * 既定は有効（ACTIVE）バリエーションのみ。true で無効も対象化する（差戻・取下の記録も見せる）。
   */
  includeInactive?: boolean;
};

/**
 * 見積申請一覧の取得オプション。ソートは固定（申請日時降順→見積番号昇順→バリエーション番号昇順）の
 * ため orderBy は持たない。`limit` は presentation の LIST_FETCH_LIMIT を受け取る（infra は
 * presentation 定数を import せず options 経由・既存クエリと対称）。フィルタ・ソート後に切り出す
 * （DB の take ではない・ADR-20260707-b36）。
 */
export type EstimateApplicationListOptions = {
  limit?: number;
};
