import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ProductCategory } from "../values/ProductCategory";
import { ProductCode } from "../values/ProductCode";
import { ProductDescription } from "../values/ProductDescription";
import { ProductId } from "../values/ProductId";
import { ProductName } from "../values/ProductName";
import { ProductNote } from "../values/ProductNote";
import { ProductRelation } from "../values/ProductRelation";
import { ProductUnit } from "../values/ProductUnit";
import { SetProductComponent } from "../values/SetProductComponent";

/**
 * 商品エンティティ（集約ルート）
 *
 * 商品区分に応じた制約を持つ:
 * - INDIVIDUAL: 周辺商品を設定可能
 * - CONSUMABLE: 周辺商品は持てない
 * - SET: 構成商品を保持
 *
 * 原価は別集約 pricing/CostPrice（商品id × 適用期間 × 原価）へ移管済（#465/#468）。
 * Product 本体は原価を持たない。
 */
export class Product {
  static readonly ENTITY_NAME = "商品";

  private constructor(
    private readonly _id: ProductId,
    private _code: ProductCode,
    private _name: ProductName,
    private readonly _category: ProductCategory,
    private _unit: ProductUnit,
    private _isActive: boolean,
    private _description: ProductDescription | null,
    private _note: ProductNote | null,
    private _relatedProducts: ProductRelation[],
    private _setComponents: SetProductComponent[],
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  static create(
    code: ProductCode,
    name: ProductName,
    category: ProductCategory,
    unit: ProductUnit,
    description: ProductDescription | null = null,
    note: ProductNote | null = null
  ): Product {
    const now = new Date();

    return new Product(
      ProductId.generate(),
      code,
      name,
      category,
      unit,
      true,
      description,
      note,
      [],
      [],
      now,
      now
    );
  }

  static reconstruct(
    id: ProductId,
    code: ProductCode,
    name: ProductName,
    category: ProductCategory,
    unit: ProductUnit,
    isActive: boolean,
    description: ProductDescription | null,
    note: ProductNote | null,
    relatedProducts: ProductRelation[],
    setComponents: SetProductComponent[],
    createdAt: Date,
    updatedAt: Date
  ): Product {
    return new Product(
      id,
      code,
      name,
      category,
      unit,
      isActive,
      description,
      note,
      relatedProducts,
      setComponents,
      createdAt,
      updatedAt
    );
  }

  // ========================================
  // ビジネスロジック
  // ========================================

  changeName(newName: ProductName): void {
    this._name = newName;
    this._updatedAt = new Date();
  }

  changeCode(newCode: ProductCode): void {
    this._code = newCode;
    this._updatedAt = new Date();
  }

  changeUnit(newUnit: ProductUnit): void {
    this._unit = newUnit;
    this._updatedAt = new Date();
  }

  changeDescription(newDescription: ProductDescription | null): void {
    this._description = newDescription;
    this._updatedAt = new Date();
  }

  changeNote(newNote: ProductNote | null): void {
    this._note = newNote;
    this._updatedAt = new Date();
  }

  activate(): void {
    if (this._isActive) {
      throw new BusinessRuleViolationError("すでに有効な商品です");
    }
    this._isActive = true;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    if (!this._isActive) {
      throw new BusinessRuleViolationError("すでに無効な商品です");
    }
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /**
   * 周辺商品を設定（全置換）
   *
   * 制約:
   * - 個別商品のみ設定可能（B003）
   * - 自己参照不可（B005）
   * - 重複不可
   */
  setRelatedProducts(relations: ProductRelation[]): void {
    if (!this._category.canHaveRelatedProducts()) {
      throw new BusinessRuleViolationError("個別商品のみ周辺商品を設定できます");
    }

    // 自己参照チェック
    for (const relation of relations) {
      if (relation.relatedProductId.equals(this._id)) {
        throw new BusinessRuleViolationError("自分自身を周辺商品に設定することはできません");
      }
    }

    // 重複チェック
    const ids = relations.map((r) => r.relatedProductId.value);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessRuleViolationError("周辺商品に重複があります");
    }

    this._relatedProducts = relations;
    this._updatedAt = new Date();
  }

  /**
   * 構成商品を設定（全置換）
   *
   * 制約:
   * - セット商品のみ設定可能（B006）
   * - 重複不可
   */
  setComponents(components: SetProductComponent[]): void {
    if (!this._category.canHaveComponents()) {
      throw new BusinessRuleViolationError("セット商品のみ構成商品を設定できます");
    }

    // 重複チェック
    const ids = components.map((c) => c.componentProductId.value);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessRuleViolationError("構成商品に重複があります");
    }

    this._setComponents = components;
    this._updatedAt = new Date();
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): ProductId {
    return this._id;
  }

  get code(): ProductCode {
    return this._code;
  }

  get name(): ProductName {
    return this._name;
  }

  get category(): ProductCategory {
    return this._category;
  }

  get unit(): ProductUnit {
    return this._unit;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get description(): ProductDescription | null {
    return this._description;
  }

  get note(): ProductNote | null {
    return this._note;
  }

  get relatedProducts(): ProductRelation[] {
    return [...this._relatedProducts];
  }

  get components(): SetProductComponent[] {
    return [...this._setComponents];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
