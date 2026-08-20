import { StringValueObject } from "@server/shared/StringValueObject";
import { generateId } from "@server/shared/generateId";

/**
 * エンティティID値オブジェクトの基底クラス
 *
 * UUIDv7フォーマットのバリデーションを提供する。
 * 各エンティティ固有のIDクラスはこのクラスを継承して作成する。
 */
export abstract class EntityId<U> extends StringValueObject<U> {
  protected static readonly LABEL = "ID";
  protected static readonly REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  protected static readonly MIN_LENGTH = 36;
  protected static readonly MAX_LENGTH = 36;
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT = "不正なUUIDv7形式です";

  /**
   * UUIDv7を生成してIDインスタンスを返すヘルパー
   *
   * 各サブクラスの generate() から呼び出す。
   */
  protected static generateValue(): string {
    return generateId();
  }
}
