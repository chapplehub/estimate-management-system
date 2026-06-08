import { FiscalYear } from "@server/shared/domain/values/FiscalYear";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { EstimateType } from "@subdomains/estimate/domain/values/EstimateType";

/**
 * 見積番号の採番ポート（§2.3 保存時採番）。
 *
 * 連番の払い出し（次番号生成）は `fiscalYear + estimateType` 単位の横断ポリシーであり、
 * 値オブジェクト EstimateNumber の責務外（VO は「保存済み採番値の検証・分解」に限定）。
 * 本ポートが「採番」という永続化バックエンド依存の操作をドメイン契約として表現する。
 *
 * ドメイン層は本インターフェースのみに依存し、具体実装（MAX(sequence)+1 等）は
 * infrastructure 層が提供する（依存方向: infrastructure → domain）。
 *
 * 戻り値を EstimateNumber（VO）とすることで、採番済み値は §2 のフォーマット検証を
 * 通過済みであることが型レベルで保証され、後続の Estimate.create() に安全に渡せる。
 */
export interface EstimateNumberIssuer {
  /**
   * 指定された年度・見積種別における次の見積番号を払い出す。
   *
   * @param fiscalYear 年度（4月始まり）
   * @param estimateType 見積種別（接頭辞 N/R/A を決定）
   * @returns 採番済みの見積番号
   */
  issueNext(fiscalYear: FiscalYear, estimateType: EstimateType): Promise<EstimateNumber>;
}
