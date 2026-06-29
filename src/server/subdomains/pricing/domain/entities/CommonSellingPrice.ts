import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { CommonSellingPricePeriodId } from "../values/CommonSellingPricePeriodId";
import { SellingUnitPrice } from "../values/SellingUnitPrice";
import { CommonSellingPricePeriod } from "./CommonSellingPricePeriod";

/** 永続化からの再構成に渡す適用期間行の記述子（子エンティティ型を露出しないため VO で受ける）。 */
export interface CommonSellingPricePeriodSnapshot {
  id: CommonSellingPricePeriodId;
  period: ApplicablePeriod;
  price: SellingUnitPrice;
}

/**
 * 共通販売単価集約（集約ルート）。
 *
 * 商品単位（identity = {@link ProductId}）で適用期間行のコレクションを内包する。
 * 「同一商品内で適用期間が重複してはならない」という不変条件を `addPeriod` の
 * `overlaps` 判定で集約内に構造保証する（ADR-0066・0029）。DB の EXCLUDE 制約
 * （ADR-0067）は並行競合に対する二重防御の最後の砦。
 */
export class CommonSellingPrice {
  static readonly ENTITY_NAME = "共通販売単価";

  private constructor(
    private readonly _productId: ProductId,
    private readonly _periods: CommonSellingPricePeriod[]
  ) {}

  /** 空の集約を生成する。 */
  static create(productId: ProductId): CommonSellingPrice {
    return new CommonSellingPrice(productId, []);
  }

  /**
   * 永続化から再構成する。DB の EXCLUDE 制約で重複ゼロが保証済みのため、
   * ここでは overlaps を再検証しない（状態の復元に徹する）。
   */
  static reconstruct(
    productId: ProductId,
    rows: ReadonlyArray<CommonSellingPricePeriodSnapshot>
  ): CommonSellingPrice {
    const periods = rows.map((row) =>
      CommonSellingPricePeriod.reconstruct(row.id, row.period, row.price)
    );
    return new CommonSellingPrice(productId, periods);
  }

  /**
   * 適用期間行を追加する。既存のどの期間とも重ならず、かつ開始日が参照日（今日）以降の場合のみ許す。
   *
   * 過去にさかのぼった行の後付け登録は「過去不変」を破るため禁止する（ADR-20260627-86b）。
   * 過去日データの投入は移行用の {@link reconstruct} 経路に限定し、業務操作からは閉じる。
   * 重複・過去開始は不変条件違反として {@link BusinessRuleViolationError} を投げ、集約は変更しない。
   *
   * @param referenceDate 参照日（今日・JST 暦日 `"YYYY-MM-DD"`）。保存実行時にサーバー生成して注入する。
   */
  addPeriod(period: ApplicablePeriod, price: SellingUnitPrice, referenceDate: string): void {
    if (period.start < referenceDate) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}の適用開始日は今日以降である必要があります: ${period.start} < ${referenceDate}`
      );
    }
    const overlapping = this._periods.find((row) => row.period.overlaps(period));
    if (overlapping !== undefined) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}の適用期間が既存の期間と重複しています`
      );
    }
    this._periods.push(CommonSellingPricePeriod.create(period, price));
  }

  /**
   * 将来行（今日 < 開始）の期間・単価を差し替える。将来行はまだどの見積も時点解決していないため
   * 全項目訂正できる（ADR-20260627-86b 軸1）。現在有効・失効の行は編集できない。
   * 新しい開始日も今日以降であり、他の行と重ならない必要がある。
   *
   * @param referenceDate 参照日（今日・JST 暦日 `"YYYY-MM-DD"`）。
   */
  editPeriod(
    periodId: CommonSellingPricePeriodId,
    changes: { period: ApplicablePeriod; price: SellingUnitPrice },
    referenceDate: string
  ): void {
    const row = this.requireRow(periodId);
    if (!this.isFuture(row.period, referenceDate)) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}は将来行のみ編集できます（現在有効・失効の行は変更不可）`
      );
    }
    if (changes.period.start < referenceDate) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}の適用開始日は今日以降である必要があります: ${changes.period.start} < ${referenceDate}`
      );
    }
    const overlapping = this._periods.find(
      (other) => other !== row && other.period.overlaps(changes.period)
    );
    if (overlapping !== undefined) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}の適用期間が既存の期間と重複しています`
      );
    }
    row.changeTo(changes.period, changes.price);
  }

  /**
   * 現在有効行（開始 ≤ 今日 < 終了）に終了日を設定して打ち切る（適用終了・end-dating）。
   * 単価・開始日は変えず、終了日のみを未来方向に確定する（現在有効行に許される唯一の編集）。
   * 単価改定は「適用終了＋新規期間追加」で表現し、各行を不変の履歴として残す（ADR-20260627-86b）。
   *
   * 終了日は今日より後でなければならない（半開区間 `[開始, 終了)` ゆえ終了日=今日は今日を被覆外にし
   * 遡及削除になるため）。また「適用終了」は打ち切り＝短縮であり延長ではないため、既存終了日が有界なら
   * 新しい終了日はそれより手前でなければならない（延長は本来失効すべき単価を生かし未来見積の単価判定を
   * 誤らせる）。既存が無期限（end=null）なら任意の未来日が正当な短縮として許される。
   *
   * @param referenceDate 参照日（今日・JST 暦日 `"YYYY-MM-DD"`）。
   */
  endDatePeriod(
    periodId: CommonSellingPricePeriodId,
    endDate: string,
    referenceDate: string
  ): void {
    const row = this.requireRow(periodId);
    if (!row.period.contains(referenceDate)) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}は現在有効行のみ適用終了できます`
      );
    }
    if (endDate <= referenceDate) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}の適用終了日は今日より後である必要があります: ${endDate} <= ${referenceDate}`
      );
    }
    if (row.period.end !== null && endDate >= row.period.end) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}の適用終了は短縮のみ可能です（既存終了日より後へは延長できません）: ${endDate} >= ${row.period.end}`
      );
    }
    const ended = ApplicablePeriod.create({ start: row.period.start, end: endDate });
    const overlapping = this._periods.find(
      (other) => other !== row && other.period.overlaps(ended)
    );
    if (overlapping !== undefined) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}の適用期間が既存の期間と重複しています`
      );
    }
    row.endDateOn(endDate);
  }

  /**
   * 未来開始行（今日 < 開始）を削除する（誤入力の訂正）。現在有効・失効の行は過去そのもの／
   * 既発行見積が時点解決した履歴のため削除できない（ADR-20260627-86b 軸1）。
   *
   * @param referenceDate 参照日（今日・JST 暦日 `"YYYY-MM-DD"`）。
   */
  deletePeriod(periodId: CommonSellingPricePeriodId, referenceDate: string): void {
    const row = this.requireRow(periodId);
    if (!this.isFuture(row.period, referenceDate)) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}は未来開始行のみ削除できます（現在有効・失効の行は削除不可）`
      );
    }
    this._periods.splice(this._periods.indexOf(row), 1);
  }

  /** identity で期間行を引く。存在しなければ不変条件違反として投げる。 */
  private requireRow(periodId: CommonSellingPricePeriodId): CommonSellingPricePeriod {
    const row = this._periods.find((r) => r.id.equals(periodId));
    if (row === undefined) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}に指定された適用期間行が存在しません`
      );
    }
    return row;
  }

  /** 将来行か（今日 < 開始）。 */
  private isFuture(period: ApplicablePeriod, referenceDate: string): boolean {
    return referenceDate < period.start;
  }

  get productId(): ProductId {
    return this._productId;
  }

  /** 適用期間行（読み取り専用ビュー）。 */
  get periods(): readonly CommonSellingPricePeriod[] {
    return this._periods;
  }
}
