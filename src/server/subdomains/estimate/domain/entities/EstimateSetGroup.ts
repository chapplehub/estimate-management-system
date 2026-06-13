import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { EstimateItemId } from "../values/EstimateItemId";
import { EstimateSetGroupId } from "../values/EstimateSetGroupId";
import { ItemName } from "../values/ItemName";
import { Memo } from "../values/Memo";
import { Unit } from "../values/Unit";

export type EstimateSetGroupCreateInput = {
  productId: ProductId;
  /** 商品名スナップショット（SET 商品マスタからの複写）。 */
  itemName: ItemName;
  /** 単位スナップショット。 */
  unit: Unit;
  /**
   * 構成明細の id（順序付き）。正準順序＝構成明細の sortOrder 順。
   * 空配列は不可（空群禁止）。
   */
  memberItemIds: EstimateItemId[];
  customerMemo?: Memo;
  internalMemo?: Memo;
};

/**
 * セット群エンティティ（ADR-0047 / Shape ③-a）。
 *
 * 価格・並び順・金額を**持たない**薄い衛星。金額＝構成明細の合計、表示位置＝構成明細の
 * 最小 sortOrder から導出する（{@link SetGroupDerivationPolicy}）。
 *
 * **案2-α（計画 設計判断 Q2）**: 群は構成明細の実体ではなく順序付き `EstimateItemId[]`
 * のみを保持する。実体（EstimateItem）は親 EstimateVariation の `_items` が単一所有し、
 * 群はその所属（交差表 `estimate_set_components` の行）を表す。これにより `estimate_items`
 * は不変のまま、所属が交差表に 1:1 で写る。
 *
 * Estimate 集約の内部子エンティティ。バレル (entities/index.ts) からは export せず、
 * 集約外コードからの直接インスタンス化を構造的に禁止する。
 */
export class EstimateSetGroup {
  static readonly ENTITY_NAME = "セット群";

  private constructor(
    private readonly _id: EstimateSetGroupId,
    private readonly _productId: ProductId,
    private _itemName: ItemName,
    private _unit: Unit,
    private _customerMemo: Memo,
    private _internalMemo: Memo,
    private readonly _memberItemIds: EstimateItemId[],
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規セット群を作成する。構成明細を 1 件も持たない空群は不正（空群禁止）。
   * 表示位置・金額を構成明細から導出するため、構成明細ゼロのセット群は意味を持たない。
   */
  static create(input: EstimateSetGroupCreateInput): EstimateSetGroup {
    if (input.memberItemIds.length === 0) {
      throw new BusinessRuleViolationError(
        "セット群は最低 1 件の構成明細を持つ必要があります（空群禁止）"
      );
    }
    const now = new Date();
    return new EstimateSetGroup(
      EstimateSetGroupId.generate(),
      input.productId,
      input.itemName,
      input.unit,
      input.customerMemo ?? Memo.empty(),
      input.internalMemo ?? Memo.empty(),
      [...input.memberItemIds],
      now,
      now
    );
  }

  /**
   * 永続化値から再構築する。保存値を信頼し、空群チェック等の再検証は行わない
   * （集約全体の「再構築時は信頼」方針と整合）。
   */
  static reconstruct(input: {
    id: EstimateSetGroupId;
    productId: ProductId;
    itemName: ItemName;
    unit: Unit;
    customerMemo: Memo;
    internalMemo: Memo;
    memberItemIds: EstimateItemId[];
    createdAt: Date;
    updatedAt: Date;
  }): EstimateSetGroup {
    return new EstimateSetGroup(
      input.id,
      input.productId,
      input.itemName,
      input.unit,
      input.customerMemo,
      input.internalMemo,
      [...input.memberItemIds],
      input.createdAt,
      input.updatedAt
    );
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): EstimateSetGroupId {
    return this._id;
  }

  get productId(): ProductId {
    return this._productId;
  }

  get itemName(): ItemName {
    return this._itemName;
  }

  get unit(): Unit {
    return this._unit;
  }

  get customerMemo(): Memo {
    return this._customerMemo;
  }

  get internalMemo(): Memo {
    return this._internalMemo;
  }

  /** 構成明細 id の順序付き読み取り専用ビュー。 */
  get memberItemIds(): ReadonlyArray<EstimateItemId> {
    return this._memberItemIds;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
