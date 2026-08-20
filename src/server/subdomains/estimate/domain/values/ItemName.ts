import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 商品名スナップショット値オブジェクト
 *
 * §11.3.1 見積明細が保持する商品名スナップショット（マスタからの複写、
 * §8 金額保存形式と整合させ見積時点の値を凍結する）。
 * Prisma `EstimateItem.itemName`（VarChar(100)）に対応する。
 *
 * Product サブドメインの ProductName とは別物として estimate 側に閉じて持つ。
 * 理由: スナップショットは凍結値であり、マスタ側 VO の制約変更で過去データの
 * 再構築が壊れることを避け、コンテキスト独立性を保つため。
 */
export class ItemName extends StringValueObject<"ItemName"> {
  protected static readonly LABEL = "商品名";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 100;

  constructor(value: string) {
    super(value.trim());
  }
}
