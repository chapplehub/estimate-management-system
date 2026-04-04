import { generateId } from "@server/shared/generateId";
import { RoleCd } from "../values/RoleCd";
import { RoleName } from "../values/RoleName";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";

/**
 * 役割エンティティ
 *
 * 組織内の具体的な役割（大阪市南課長、営業部長など）を表現する。
 * 各役割は1つの役職に属し、上位役割への参照を持つ。
 * 承認フローは上位役割チェーンを辿って構築される。
 */
export class Role {
  /** エンティティ名（エラーメッセージ用） */
  static readonly ENTITY_NAME = "役割";

  private constructor(
    private readonly _id: string,
    private readonly _roleCd: RoleCd,
    private _name: RoleName,
    private readonly _positionId: string,
    private _superiorRoleId: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規役割を作成
   */
  static create(
    roleCd: RoleCd,
    name: RoleName,
    positionId: string,
    superiorRoleId: string | null = null
  ): Role {
    const now = new Date();
    return new Role(generateId(), roleCd, name, positionId, superiorRoleId, now, now);
  }

  /**
   * DBから役割を再構築
   */
  static reconstruct(
    id: string,
    roleCd: RoleCd,
    name: RoleName,
    positionId: string,
    superiorRoleId: string | null,
    createdAt: Date,
    updatedAt: Date
  ): Role {
    return new Role(id, roleCd, name, positionId, superiorRoleId, createdAt, updatedAt);
  }

  // ========================================
  // ビジネスロジック
  // ========================================

  /**
   * 役割名を変更
   */
  changeName(newName: RoleName): void {
    this._name = newName;
    this._updatedAt = new Date();
  }

  /**
   * 上位役割を変更
   *
   * 自分自身を上位役割に設定することはできない。
   * 上位役職に属する役割かどうかの検証はドメインサービスで行う。
   */
  changeSuperiorRole(newSuperiorRoleId: string | null): void {
    if (newSuperiorRoleId === this._id) {
      throw new BusinessRuleViolationError("自分自身を上位役割にすることはできません");
    }
    this._superiorRoleId = newSuperiorRoleId;
    this._updatedAt = new Date();
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): string {
    return this._id;
  }

  get roleCd(): RoleCd {
    return this._roleCd;
  }

  get name(): RoleName {
    return this._name;
  }

  get positionId(): string {
    return this._positionId;
  }

  get superiorRoleId(): string | null {
    return this._superiorRoleId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
