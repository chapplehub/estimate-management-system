import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 単位スナップショット値オブジェクト
 *
 * §11.3.1 見積明細が保持する単位スナップショット（Product.unit enum の
 * スナップショット文字列）。Prisma `EstimateItem.unit`（VarChar(20)）に対応する。
 *
 * Product サブドメインの ProductUnit（enum VO）を再利用せず、自由文字列の
 * 凍結値として estimate 側に閉じて持つ。理由: 将来 enum 値が変更されても
 * 過去スナップショットの再構築が壊れないようにするため。
 */
export class Unit extends StringValueObject<"Unit"> {
  protected static readonly LABEL = "単位";
  protected static readonly MIN_LENGTH = 1;
  protected static readonly MAX_LENGTH = 20;

  constructor(value: string) {
    super(value.trim());
  }
}
