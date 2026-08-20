import { v7 as uuidv7 } from "uuid";

/**
 * UUIDv7形式のIDを生成する
 *
 * プロジェクト全体で使用する共有ID生成関数。
 * UUIDv7はタイムスタンプベースで時系列ソートが可能。
 */
export function generateId(): string {
  return uuidv7();
}
