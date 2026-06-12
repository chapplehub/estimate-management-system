import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { EstimateAmountPolicy } from "../policies/EstimateAmountPolicy";
import { DiscountRate } from "../values/DiscountRate";
import type { EstimateItemId } from "../values/EstimateItemId";
import { EstimateVariationId } from "../values/EstimateVariationId";
import { Memo } from "../values/Memo";
import { Money } from "../values/Money";
import type { Quantity } from "../values/Quantity";
import type { SubmissionType } from "../values/SubmissionType";
import type { TaxRate } from "../values/TaxRate";
import type { TaxRoundingType } from "../values/TaxRoundingType";
import { VariationStatus } from "../values/VariationStatus";
import { EstimateItem } from "./EstimateItem";

/** §3.3 バリエーション番号は 1〜99。 */
const VARIATION_NUMBER_MIN = 1;
const VARIATION_NUMBER_MAX = 99;

/**
 * 再計算のたびに親 Estimate から渡される税情報。
 *
 * Variation 自身は税率を保持しない（計画 設計判断より）。理由:
 *  - 税率は集約ルート Estimate に 1 つだけ存在し、全 Variation 共通
 *  - Variation に税率を持たせると Estimate との二重管理になる
 */
export type TaxContext = {
  taxRate: TaxRate;
  taxRoundingType: TaxRoundingType;
};

/**
 * バリエーション内容（番号・ステータスを除く編集対象）。C3 AddVariation の追加内容、
 * C4 UpdateVariation の全置換内容として共用する。明細は構築済み EstimateItem の配列で渡す。
 */
export type VariationContent = {
  items: EstimateItem[];
  overallDiscount?: Money;
  customerMemo?: Memo;
  internalMemo?: Memo;
};

/**
 * 見積バリエーションエンティティ（§11.3.1）。
 *
 * Estimate 集約の内部子エンティティ。バレル (entities/index.ts) からは
 * export せず、集約外コードからの直接インスタンス化を構造的に禁止する。
 * 全 public メソッドは集約ルート Estimate 経由でのみ呼ばれる前提。
 *
 * **集約内不変条件として常に集計が最新**: 明細の追加・削除・更新および
 * overallDiscount 変更のたびに EstimateAmountPolicy で 5 集計値を自動
 * 再計算する。discountSubtotal は明細の itemDiscount を合算して算出。
 *
 * **集約境界規約**: 子 EstimateItem は外から直接操作できないため、本
 * クラスが `changeItem*()` 委譲メソッド群を提供する。これにより集約内の
 * 全状態変更が Variation を経由し、再計算の取りこぼしが構造的に発生し
 * ない。
 */
export class EstimateVariation {
  static readonly ENTITY_NAME = "見積バリエーション";

  private constructor(
    private readonly _id: EstimateVariationId,
    private _variationNumber: number,
    // 不変保存属性（ADR-0045）。ミューテータは提供せず、構造で不変性を担保する
    private readonly _submissionType: SubmissionType,
    // 改訂出自（ADR-0044）。改訂で生まれたバリエーションのみ改訂元 ID を持つ（高々1）。
    // 永続化は EstimateVariationRevision（系譜）への写像で行う
    private readonly _revisedFrom: EstimateVariationId | null,
    private _status: VariationStatus,
    private _customerMemo: Memo,
    private _internalMemo: Memo,
    private _overallDiscount: Money,
    private readonly _items: EstimateItem[],
    private _subtotal: Money,
    private _discountSubtotal: Money,
    private _finalSubtotal: Money,
    private _taxAmount: Money,
    private _finalTotal: Money,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規バリエーションを作成する。集計 5 種は自動算出。
   *
   * items は空配列を許可する（明細を後から追加するワークフローも有効）。
   */
  static create(input: {
    variationNumber: number;
    /** 提出区分（ADR-0045）。作成時に確定し、以後変更できない */
    submissionType: SubmissionType;
    /** 改訂出自（ADR-0044）。得意先改訂で生まれた場合のみ改訂元 ID を渡す。 */
    revisedFrom?: EstimateVariationId | null;
    tax: TaxContext;
    status?: VariationStatus;
    items?: EstimateItem[];
    overallDiscount?: Money;
    /** 顧客メモ。省略時は空メモ（Memo.empty()）。 */
    customerMemo?: Memo;
    /** 社内メモ。省略時は空メモ（Memo.empty()）。 */
    internalMemo?: Memo;
  }): EstimateVariation {
    EstimateVariation.assertVariationNumber(input.variationNumber);

    const items = input.items ?? [];
    const overallDiscount = input.overallDiscount ?? Money.zero();
    const totals = EstimateVariation.computeTotals(items, overallDiscount, input.tax);
    const now = new Date();

    return new EstimateVariation(
      EstimateVariationId.generate(),
      input.variationNumber,
      input.submissionType,
      input.revisedFrom ?? null,
      input.status ?? VariationStatus.ACTIVE,
      input.customerMemo ?? Memo.empty(),
      input.internalMemo ?? Memo.empty(),
      overallDiscount,
      items,
      totals.subtotal,
      totals.discountSubtotal,
      totals.finalSubtotal,
      totals.taxAmount,
      totals.finalTotal,
      now,
      now
    );
  }

  /**
   * 永続化値から再構築する。保存済み集計は再計算せずそのまま信頼する
   * （§8 金額の保存形式に従い、見積時点の値を保持するため）。
   */
  static reconstruct(input: {
    id: EstimateVariationId;
    variationNumber: number;
    submissionType: SubmissionType;
    revisedFrom: EstimateVariationId | null;
    status: VariationStatus;
    customerMemo: Memo;
    internalMemo: Memo;
    overallDiscount: Money;
    items: EstimateItem[];
    subtotal: Money;
    discountSubtotal: Money;
    finalSubtotal: Money;
    taxAmount: Money;
    finalTotal: Money;
    createdAt: Date;
    updatedAt: Date;
  }): EstimateVariation {
    return new EstimateVariation(
      input.id,
      input.variationNumber,
      input.submissionType,
      input.revisedFrom,
      input.status,
      input.customerMemo,
      input.internalMemo,
      input.overallDiscount,
      input.items,
      input.subtotal,
      input.discountSubtotal,
      input.finalSubtotal,
      input.taxAmount,
      input.finalTotal,
      input.createdAt,
      input.updatedAt
    );
  }

  // ========================================
  // 明細管理（追加・削除）
  // ========================================

  addItem(item: EstimateItem, tax: TaxContext): void {
    this.assertLineStructureMutable();
    this._items.push(item);
    this.recalculate(tax);
  }

  removeItem(itemId: EstimateItemId, tax: TaxContext): void {
    this.assertLineStructureMutable();
    const index = this._items.findIndex((i) => i.id.equals(itemId));
    if (index === -1) {
      throw new BusinessRuleViolationError(
        `指定された明細はこのバリエーションに存在しません: ${itemId.value}`
      );
    }
    this._items.splice(index, 1);
    this.recalculate(tax);
  }

  // ========================================
  // 明細委譲メソッド（集約境界規約により、外から直接 item を触れないため）
  // ========================================

  changeItemQuantity(itemId: EstimateItemId, newQuantity: Quantity, tax: TaxContext): void {
    this.findItemOrThrow(itemId).changeQuantity(newQuantity);
    this.recalculate(tax);
  }

  changeItemUnitPrice(itemId: EstimateItemId, newPrice: Money, tax: TaxContext): void {
    this.findItemOrThrow(itemId).changeUnitPrice(newPrice);
    this.recalculate(tax);
  }

  changeItemDiscountRate(itemId: EstimateItemId, newRate: DiscountRate, tax: TaxContext): void {
    this.findItemOrThrow(itemId).changeDiscountRate(newRate);
    this.recalculate(tax);
  }

  changeItemDiscount(itemId: EstimateItemId, newDiscount: Money, tax: TaxContext): void {
    this.findItemOrThrow(itemId).changeItemDiscount(newDiscount);
    this.recalculate(tax);
  }

  // ========================================
  // 集計に関わる変更
  // ========================================

  changeOverallDiscount(newDiscount: Money, tax: TaxContext): void {
    this._overallDiscount = newDiscount;
    this.recalculate(tax);
  }

  /**
   * 税情報のみ変わったときの再計算（明細・割引は変えない）。Estimate ルートが
   * 税率変更時に各 Variation に対して呼ぶことを想定。
   */
  recalculateForTaxChange(tax: TaxContext): void {
    this.recalculate(tax);
  }

  /**
   * バリエーション内容（明細・全体値引・メモ）を宣言的に一括差替えする（C4 UpdateVariation）。
   *
   * 編集画面のフォーム全体を保存する用途。明細は識別子を保持せず新セットで全置換し、
   * 最後に 1 回だけ再計算する（granular な addItem 連打による O(N^2) 再計算を避ける）。
   * 永続化側（PrismaEstimateRepository.update）は id 差分 upsert で旧明細行を削除・新行を挿入する。
   *
   * §3.4: 無効状態のバリエーションは編集不可。先頭で assertEditable() で弾く。
   */
  replaceContent(input: VariationContent, tax: TaxContext): void {
    this.assertEditable();
    // 全置換は構造上「全行削除＋全行追加」であり行構成固定（§7.2）と原理的に矛盾する。
    // 改訂先の調整は粒度別メソッド（changeItem* / changeOverallDiscount / メモ変更）で行う
    this.assertLineStructureMutable();

    // _items は readonly 参照だが配列中身は可変。同一参照を保ったまま全置換する。
    this._items.length = 0;
    this._items.push(...input.items);
    this._overallDiscount = input.overallDiscount ?? Money.zero();
    this._customerMemo = input.customerMemo ?? Memo.empty();
    this._internalMemo = input.internalMemo ?? Memo.empty();

    this.recalculate(tax);
  }

  // ========================================
  // 状態遷移・メタ情報
  // ========================================

  activate(): void {
    this._status = VariationStatus.ACTIVE;
    this.touch();
  }

  deactivate(): void {
    this._status = VariationStatus.INACTIVE;
    this.touch();
  }

  changeVariationNumber(newNumber: number): void {
    EstimateVariation.assertVariationNumber(newNumber);
    this._variationNumber = newNumber;
    this.touch();
  }

  changeCustomerMemo(newMemo: Memo): void {
    this._customerMemo = newMemo;
    this.touch();
  }

  changeInternalMemo(newMemo: Memo): void {
    this._internalMemo = newMemo;
    this.touch();
  }

  // ========================================
  // 内部ヘルパ
  // ========================================

  private recalculate(tax: TaxContext): void {
    const totals = EstimateVariation.computeTotals(this._items, this._overallDiscount, tax);
    this._subtotal = totals.subtotal;
    this._discountSubtotal = totals.discountSubtotal;
    this._finalSubtotal = totals.finalSubtotal;
    this._taxAmount = totals.taxAmount;
    this._finalTotal = totals.finalTotal;
    this.touch();
  }

  /**
   * EstimateAmountPolicy + discountSubtotal の総合計算。
   *
   * EstimateAmountPolicy は §8.1(4)〜(7) のうち subtotal / afterOverallDiscount
   * （= 永続化スキーマの finalSubtotal）/ taxAmount / finalTotal を返す。
   * discountSubtotal（§8 表示用の値引小計）は明細側の値なのでここで合算する。
   */
  private static computeTotals(
    items: ReadonlyArray<EstimateItem>,
    overallDiscount: Money,
    tax: TaxContext
  ): {
    subtotal: Money;
    discountSubtotal: Money;
    finalSubtotal: Money;
    taxAmount: Money;
    finalTotal: Money;
  } {
    const finalLineAmounts = items.map((i) => i.finalAmount);
    const policyResult = EstimateAmountPolicy.calculate({
      finalLineAmounts,
      overallDiscount,
      taxRate: tax.taxRate,
      taxRoundingType: tax.taxRoundingType,
    });
    const discountSubtotal = items.reduce((acc, i) => acc.add(i.itemDiscount), Money.zero());

    return {
      subtotal: policyResult.subtotal,
      discountSubtotal,
      finalSubtotal: policyResult.afterOverallDiscount,
      taxAmount: policyResult.taxAmount,
      finalTotal: policyResult.finalTotal,
    };
  }

  /** §3.4: 無効状態のバリエーションは編集不可。 */
  private assertEditable(): void {
    if (this._status.isInactive()) {
      throw new BusinessRuleViolationError("無効状態のバリエーションは編集できません");
    }
  }

  /**
   * 行構成固定（§7.2）: 改訂で生まれたバリエーションは明細の追加・削除不可。
   * 改訂元との明細1:1対応を保全し、明細単位の粗利（deliveryPrice − 得意先価格・§8.4）を
   * 常に計算可能に保つ。単価・掛率・値引・数量・メモの調整は許可される。
   */
  private assertLineStructureMutable(): void {
    if (this._revisedFrom !== null) {
      throw new BusinessRuleViolationError(
        "改訂で生まれたバリエーションは明細の追加・削除ができません（行構成固定・§7.2）"
      );
    }
  }

  private findItemOrThrow(itemId: EstimateItemId): EstimateItem {
    const item = this._items.find((i) => i.id.equals(itemId));
    if (!item) {
      throw new BusinessRuleViolationError(
        `指定された明細はこのバリエーションに存在しません: ${itemId.value}`
      );
    }
    return item;
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static assertVariationNumber(value: number): void {
    if (!Number.isInteger(value)) {
      throw new ValidationError("バリエーション番号は整数で指定してください");
    }
    if (value < VARIATION_NUMBER_MIN || value > VARIATION_NUMBER_MAX) {
      throw new ValidationError(
        `バリエーション番号は${VARIATION_NUMBER_MIN}〜${VARIATION_NUMBER_MAX}の範囲で指定してください`
      );
    }
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): EstimateVariationId {
    return this._id;
  }

  get variationNumber(): number {
    return this._variationNumber;
  }

  get submissionType(): SubmissionType {
    return this._submissionType;
  }

  /** 改訂出自（ADR-0044）。改訂で生まれていなければ null。 */
  get revisedFrom(): EstimateVariationId | null {
    return this._revisedFrom;
  }

  get status(): VariationStatus {
    return this._status;
  }

  isActive(): boolean {
    return this._status.isActive();
  }

  get customerMemo(): Memo {
    return this._customerMemo;
  }

  get internalMemo(): Memo {
    return this._internalMemo;
  }

  get overallDiscount(): Money {
    return this._overallDiscount;
  }

  /**
   * 明細リストの読み取り専用ビュー。集約境界規約のため、要素は
   * Readonly でラップして外部からの状態変更を型で禁止する。
   */
  get items(): ReadonlyArray<Readonly<EstimateItem>> {
    return this._items;
  }

  get subtotal(): Money {
    return this._subtotal;
  }

  get discountSubtotal(): Money {
    return this._discountSubtotal;
  }

  get finalSubtotal(): Money {
    return this._finalSubtotal;
  }

  get taxAmount(): Money {
    return this._taxAmount;
  }

  get finalTotal(): Money {
    return this._finalTotal;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
