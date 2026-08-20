import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * メモ値オブジェクト（任意項目）
 *
 * 見積明細・見積バリエーションの顧客メモ / 社内メモで共用する。
 * 「未入力」は null ではなく空 Memo（value === ""）で表現し、null を
 * ドメインから排除する。null / undefined / 空白のみ の吸収は {@link create}
 * の1点に集約し、ドメイン内には常に非null の Memo を流す。
 *
 * エラーメッセージは技術的制約（最大長）のみを表す汎用 label とし、
 * 顧客 / 社内 の区別は付けない。
 */
export class Memo extends StringValueObject<"Memo"> {
  protected static readonly LABEL = "メモ";
  protected static readonly MAX_LENGTH = 2000;

  // 生成は必ず create 経由に強制する（null 吸収を一極集中させるため）。
  private constructor(value: string) {
    super(value.trim());
  }

  /** 任意入力の唯一の入口。null / undefined / 空白 はすべて空 Memo に正規化する。 */
  static create(value: string | null | undefined): Memo {
    return new Memo(value ?? "");
  }

  /** 「メモなし」を明示的に作る読みやすさ用ヘルパ（= create(null)）。 */
  static empty(): Memo {
    return Memo.create(null);
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }
}
