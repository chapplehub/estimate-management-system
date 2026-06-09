import { TaxRateMaster } from "@subdomains/estimate/domain/entities/TaxRateMaster";

/**
 * 消費税率マスタのリポジトリポート（設計書 §11.5 / §8.7）。
 *
 * 税率タイムラインは制度上単調（ギャップなし）であることを利用し、適用税率は
 * 「effectiveFrom <= 対象日時 の中で effectiveFrom が最大の行」で一意に決まる
 * （schema コメントの設計に準拠）。この「ある日時の有効税率を引く」解決は
 * 永続化バックエンド依存の操作であり、本ポートがドメイン契約として表現する。
 *
 * ドメイン層は本インターフェースのみに依存し、具体実装（ORDER BY ... LIMIT 1）は
 * infrastructure 層が提供する（依存方向: infrastructure → domain）。
 */
export interface TaxRateRepository {
  /**
   * 指定日時に適用される消費税率マスタ行を返す。
   *
   * @param date 適用税率を求める対象日時
   * @returns 適用税率行。対象日時が最古行より前で該当が無い場合は null
   */
  findEffectiveAt(date: Date): Promise<TaxRateMaster | null>;
}
