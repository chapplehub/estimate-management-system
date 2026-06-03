import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * メモ値オブジェクト
 *
 * 見積明細・見積バリエーションの顧客メモ / 社内メモで共用する任意項目。
 * Prisma `EstimateItem.customerMemo / internalMemo` および
 * `EstimateVariation.customerMemo / internalMemo`（VarChar(2000)）に対応する。
 *
 * null 許容は VO 内部では表現せず、呼び出し側で `Memo | null` として扱う
 * （既存流儀: ProductNote | null）。エラーメッセージは技術的制約（最大長）の
 * みを表す汎用 label とし、顧客 / 社内 の区別は付けない。
 */
export class Memo extends StringValueObject<"Memo"> {
  protected static readonly LABEL = "メモ";
  protected static readonly MAX_LENGTH = 2000;

  constructor(value: string) {
    super(value.trim());
  }
}
