import { ValidationError } from "@server/shared/errors/DomainError";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { LineItemAmountPolicy } from "../policies/LineItemAmountPolicy";
import { DiscountRate } from "../values/DiscountRate";
import { EstimateItemId } from "../values/EstimateItemId";
import { Money } from "../values/Money";
import { Quantity } from "../values/Quantity";
import { RevisedEstimateItemDetail } from "./RevisedEstimateItemDetail";

/** Prisma スキーマの VarChar 上限と整合（簡易バリデーション）。 */
const ITEM_NAME_MAX = 100;
const UNIT_MAX = 20;
const MEMO_MAX = 2000;

export type EstimateItemCreateInput = {
  productId: ProductId;
  sortOrder: number;
  /** 商品名スナップショット（マスタからの複写、§8 金額保存形式と整合）。 */
  itemName: string;
  quantity: Quantity;
  /** 単位スナップショット（Product.unit enum 文字列）。 */
  unit: string;
  unitPrice: Money;
  /** 掛率。省略時は 1.0（値引なし）。 */
  discountRate?: DiscountRate;
  /** 明細値引金額。省略時はゼロ。 */
  itemDiscount?: Money;
  customerMemo?: string | null;
  internalMemo?: string | null;
  /** 得意先改訂で生まれた明細のみ持つ固有属性。省略時は null。 */
  revisedDetail?: RevisedEstimateItemDetail | null;
};

/**
 * 見積明細エンティティ（§11.3.1）。
 *
 * Estimate 集約の内部子エンティティ。バレル (entities/index.ts) からは
 * export せず、集約外コードからの直接インスタンス化を構造的に禁止する。
 * public メソッドは集約ルート (Estimate) または親 EstimateVariation から
 * のみ呼ばれる前提。
 *
 * 金額（baseAmount / discountedAmount / finalAmount）は内部状態の派生値
 * であり、quantity / unitPrice / discountRate / itemDiscount のいずれかが
 * 変化したら自動で再計算する（計画 設計判断 3「集約内不変条件」）。
 * 計算規約は {@link LineItemAmountPolicy} に委譲。
 */
export class EstimateItem {
  static readonly ENTITY_NAME = "見積明細";

  private constructor(
    private readonly _id: EstimateItemId,
    private readonly _productId: ProductId,
    private _sortOrder: number,
    private _itemName: string,
    private _quantity: Quantity,
    private _unit: string,
    private _unitPrice: Money,
    private _discountRate: DiscountRate,
    private _itemDiscount: Money,
    private _customerMemo: string | null,
    private _internalMemo: string | null,
    private _revisedDetail: RevisedEstimateItemDetail | null,
    private _baseAmount: Money,
    private _discountedAmount: Money,
    private _finalAmount: Money,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規明細を作成する。金額 3 種は LineItemAmountPolicy で自動算出する。
   */
  static create(input: EstimateItemCreateInput): EstimateItem {
    EstimateItem.assertItemName(input.itemName);
    EstimateItem.assertUnit(input.unit);
    EstimateItem.assertMemo(input.customerMemo ?? null, "顧客メモ");
    EstimateItem.assertMemo(input.internalMemo ?? null, "社内メモ");

    const discountRate = input.discountRate ?? new DiscountRate(1.0);
    const itemDiscount = input.itemDiscount ?? Money.zero();
    const amounts = LineItemAmountPolicy.calculate(
      input.unitPrice,
      input.quantity,
      discountRate,
      itemDiscount
    );
    const now = new Date();

    return new EstimateItem(
      EstimateItemId.generate(),
      input.productId,
      input.sortOrder,
      input.itemName,
      input.quantity,
      input.unit,
      input.unitPrice,
      discountRate,
      itemDiscount,
      input.customerMemo ?? null,
      input.internalMemo ?? null,
      input.revisedDetail ?? null,
      amounts.baseAmount,
      amounts.discountedAmount,
      amounts.finalAmount,
      now,
      now
    );
  }

  /**
   * 永続化値から再構築する。保存済みの金額 3 種は再計算せず信頼する
   * （DB から読み戻すたびに再計算するとマスタ改訂・税率変更で値が変わって
   *  しまい、§8 「金額の保存形式」と整合しないため）。
   */
  static reconstruct(input: {
    id: EstimateItemId;
    productId: ProductId;
    sortOrder: number;
    itemName: string;
    quantity: Quantity;
    unit: string;
    unitPrice: Money;
    discountRate: DiscountRate;
    itemDiscount: Money;
    customerMemo: string | null;
    internalMemo: string | null;
    revisedDetail: RevisedEstimateItemDetail | null;
    baseAmount: Money;
    discountedAmount: Money;
    finalAmount: Money;
    createdAt: Date;
    updatedAt: Date;
  }): EstimateItem {
    return new EstimateItem(
      input.id,
      input.productId,
      input.sortOrder,
      input.itemName,
      input.quantity,
      input.unit,
      input.unitPrice,
      input.discountRate,
      input.itemDiscount,
      input.customerMemo,
      input.internalMemo,
      input.revisedDetail,
      input.baseAmount,
      input.discountedAmount,
      input.finalAmount,
      input.createdAt,
      input.updatedAt
    );
  }

  // ========================================
  // 状態変更メソッド（金額関連は自動再計算）
  // ========================================

  changeQuantity(newQuantity: Quantity): void {
    this._quantity = newQuantity;
    this.recalculate();
  }

  changeUnitPrice(newPrice: Money): void {
    this._unitPrice = newPrice;
    this.recalculate();
  }

  changeDiscountRate(newRate: DiscountRate): void {
    this._discountRate = newRate;
    this.recalculate();
  }

  changeItemDiscount(newDiscount: Money): void {
    this._itemDiscount = newDiscount;
    this.recalculate();
  }

  changeSortOrder(newOrder: number): void {
    this._sortOrder = newOrder;
    this.touch();
  }

  changeItemName(newName: string): void {
    EstimateItem.assertItemName(newName);
    this._itemName = newName;
    this.touch();
  }

  changeUnit(newUnit: string): void {
    EstimateItem.assertUnit(newUnit);
    this._unit = newUnit;
    this.touch();
  }

  changeCustomerMemo(newMemo: string | null): void {
    EstimateItem.assertMemo(newMemo, "顧客メモ");
    this._customerMemo = newMemo;
    this.touch();
  }

  changeInternalMemo(newMemo: string | null): void {
    EstimateItem.assertMemo(newMemo, "社内メモ");
    this._internalMemo = newMemo;
    this.touch();
  }

  attachRevisedDetail(detail: RevisedEstimateItemDetail): void {
    this._revisedDetail = detail;
    this.touch();
  }

  detachRevisedDetail(): void {
    this._revisedDetail = null;
    this.touch();
  }

  // ========================================
  // 内部ヘルパ
  // ========================================

  private recalculate(): void {
    const amounts = LineItemAmountPolicy.calculate(
      this._unitPrice,
      this._quantity,
      this._discountRate,
      this._itemDiscount
    );
    this._baseAmount = amounts.baseAmount;
    this._discountedAmount = amounts.discountedAmount;
    this._finalAmount = amounts.finalAmount;
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static assertItemName(value: string): void {
    if (value.length === 0) {
      throw new ValidationError("商品名は必須です");
    }
    if (value.length > ITEM_NAME_MAX) {
      throw new ValidationError(`商品名は${ITEM_NAME_MAX}文字以内で入力してください`);
    }
  }

  private static assertUnit(value: string): void {
    if (value.length === 0) {
      throw new ValidationError("単位は必須です");
    }
    if (value.length > UNIT_MAX) {
      throw new ValidationError(`単位は${UNIT_MAX}文字以内で入力してください`);
    }
  }

  private static assertMemo(value: string | null, label: string): void {
    if (value === null) return;
    if (value.length > MEMO_MAX) {
      throw new ValidationError(`${label}は${MEMO_MAX}文字以内で入力してください`);
    }
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): EstimateItemId {
    return this._id;
  }

  get productId(): ProductId {
    return this._productId;
  }

  get sortOrder(): number {
    return this._sortOrder;
  }

  get itemName(): string {
    return this._itemName;
  }

  get quantity(): Quantity {
    return this._quantity;
  }

  get unit(): string {
    return this._unit;
  }

  get unitPrice(): Money {
    return this._unitPrice;
  }

  get discountRate(): DiscountRate {
    return this._discountRate;
  }

  get itemDiscount(): Money {
    return this._itemDiscount;
  }

  get customerMemo(): string | null {
    return this._customerMemo;
  }

  get internalMemo(): string | null {
    return this._internalMemo;
  }

  get revisedDetail(): RevisedEstimateItemDetail | null {
    return this._revisedDetail;
  }

  get baseAmount(): Money {
    return this._baseAmount;
  }

  get discountedAmount(): Money {
    return this._discountedAmount;
  }

  get finalAmount(): Money {
    return this._finalAmount;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
