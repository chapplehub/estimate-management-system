import { PositionCd } from "../values/PositionCd";
import { PositionId } from "../values/PositionId";
import { PositionName } from "../values/PositionName";

/**
 * 役職エンティティ
 *
 * 組織における役職（課長・部長・本部長・社長）を表現する。
 * 固定4種のマスタデータのため、create() は提供せず reconstruct() のみ。
 */
export class Position {
  /** エンティティ名（エラーメッセージ用） */
  static readonly ENTITY_NAME = "役職";

  private constructor(
    private readonly _id: PositionId,
    private readonly _positionCd: PositionCd,
    private readonly _name: PositionName,
    private readonly _superiorPositionId: PositionId | null,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date
  ) {}

  /**
   * DBから役職を再構築
   */
  static reconstruct(
    id: PositionId,
    positionCd: PositionCd,
    name: PositionName,
    superiorPositionId: PositionId | null,
    createdAt: Date,
    updatedAt: Date
  ): Position {
    return new Position(id, positionCd, name, superiorPositionId, createdAt, updatedAt);
  }

  /**
   * 最上位の役職かどうか（社長 = superiorPositionId が null）
   */
  isTopLevel(): boolean {
    return this._superiorPositionId === null;
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): PositionId {
    return this._id;
  }

  get positionCd(): PositionCd {
    return this._positionCd;
  }

  get name(): PositionName {
    return this._name;
  }

  get superiorPositionId(): PositionId | null {
    return this._superiorPositionId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
