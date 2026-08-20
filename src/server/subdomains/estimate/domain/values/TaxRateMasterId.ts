import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 消費税率マスタID値オブジェクト
 *
 * UUIDv7 形式のバリデーションのみ継承する。新規採番（generate）は本イシューの
 * スコープ外（マスタの書き込み経路 = 管理画面・CRUD は未着手）のため定義しない。
 * 書き込み経路を実装する際に generate() を追加する。
 */
export class TaxRateMasterId extends EntityId<"TaxRateMasterId"> {}
