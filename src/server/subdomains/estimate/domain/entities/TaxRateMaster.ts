import type { TaxRate } from "../values/TaxRate";
import type { TaxRateMasterId } from "../values/TaxRateMasterId";

/**
 * 消費税率マスタ（設計書 §11.5「消費税率マスタ」）。
 *
 * タイムラインの単調性（制度上ギャップなし）を利用し、各行は「この日時から税率は X」
 * というイベントを表す。前期間の終わり = 次の行の effectiveFrom（暗黙）。
 *
 * 税率の "値" は値オブジェクト TaxRate が担い、本エンティティは「ある日時から有効な
 * 税率行」というマスタの1行を表す（名前衝突を避けるため Master を付す）。
 *
 * 本イシューではマスタは読み取り専用。新規作成（create / UUIDv7 採番）は書き込み経路
 * （管理画面・CRUD）のスコープであり未実装のため、永続化からの復元 reconstruct のみ提供する。
 */
export class TaxRateMaster {
  private constructor(
    private readonly _id: TaxRateMasterId,
    private readonly _rate: TaxRate,
    private readonly _effectiveFrom: Date
  ) {}

  static reconstruct(id: TaxRateMasterId, rate: TaxRate, effectiveFrom: Date): TaxRateMaster {
    return new TaxRateMaster(id, rate, effectiveFrom);
  }

  get id(): TaxRateMasterId {
    return this._id;
  }

  get rate(): TaxRate {
    return this._rate;
  }

  get effectiveFrom(): Date {
    return this._effectiveFrom;
  }
}
