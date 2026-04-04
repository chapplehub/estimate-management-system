import { generateId } from "@server/shared/generateId";
import { DepartmentCd } from "../values/DepartmentCd";
import { DepartmentName } from "../values/DepartmentName";
import { Abbreviation } from "../values/Abbreviation";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";

/**
 * 部署エンティティ
 *
 * 階層構造を持ち、従業員の所属先となる組織単位を表現する。
 */
export class Department {
  /** エンティティ名（エラーメッセージ用） */
  static readonly ENTITY_NAME = "部署";

  private constructor(
    private readonly _id: string,
    private readonly _departmentCd: DepartmentCd,
    private _name: DepartmentName,
    private _abbreviation: Abbreviation,
    private _isActive: boolean,
    private _parentId: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規部署を作成
   *
   * @param departmentCd 部署コード
   * @param name 部署名
   * @param abbreviation 略称
   * @param parentId 親部署ID（ルート部署の場合は null）
   * @returns 部署エンティティ
   */
  static create(
    departmentCd: DepartmentCd,
    name: DepartmentName,
    abbreviation: Abbreviation,
    parentId: string | null = null
  ): Department {
    const now = new Date();

    return new Department(
      generateId(), // UUIDv7を生成
      departmentCd,
      name,
      abbreviation,
      true, // 新規作成時は有効
      parentId,
      now,
      now
    );
  }

  /**
   * DBから部署を再構築
   *
   * @param id ID（CUID）
   * @param departmentCd 部署コード
   * @param name 部署名
   * @param abbreviation 略称
   * @param isActive 有効フラグ
   * @param parentId 親部署ID
   * @param createdAt 作成日時
   * @param updatedAt 更新日時
   * @returns 部署エンティティ
   */
  static reconstruct(
    id: string,
    departmentCd: DepartmentCd,
    name: DepartmentName,
    abbreviation: Abbreviation,
    isActive: boolean,
    parentId: string | null,
    createdAt: Date,
    updatedAt: Date
  ): Department {
    return new Department(
      id,
      departmentCd,
      name,
      abbreviation,
      isActive,
      parentId,
      createdAt,
      updatedAt
    );
  }

  // ========================================
  // ビジネスロジック
  // ========================================

  /**
   * 部署名を変更
   */
  changeName(newName: DepartmentName): void {
    this._name = newName;
    this._updatedAt = new Date();
  }

  /**
   * 略称を変更
   */
  changeAbbreviation(newAbbreviation: Abbreviation): void {
    this._abbreviation = newAbbreviation;
    this._updatedAt = new Date();
  }

  /**
   * 親部署を変更
   *
   * @param newParentId 新しい親部署ID（ルートにする場合は null）
   */
  changeParent(newParentId: string | null): void {
    // 自分自身を親にすることはできない
    if (newParentId === this._id) {
      throw new BusinessRuleViolationError("自分自身を親部署にすることはできません");
    }
    this._parentId = newParentId;
    this._updatedAt = new Date();
  }

  /**
   * 部署を有効化
   */
  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  /**
   * 部署を無効化（論理削除）
   */
  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /**
   * ルート部署かどうか
   */
  isRoot(): boolean {
    return this._parentId === null;
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): string {
    return this._id;
  }

  get departmentCd(): DepartmentCd {
    return this._departmentCd;
  }

  get name(): DepartmentName {
    return this._name;
  }

  get abbreviation(): Abbreviation {
    return this._abbreviation;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get parentId(): string | null {
    return this._parentId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
