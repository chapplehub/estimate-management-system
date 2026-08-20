import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { CommonSellingPriceRepository } from "@subdomains/pricing/domain/repositories/CommonSellingPriceRepository";
import { CommonSellingPricePeriodId } from "@subdomains/pricing/domain/values/CommonSellingPricePeriodId";
import { loadCommonSellingPriceOrThrow } from "./loadCommonSellingPriceOrThrow";

export type DeleteCommonSellingPricePeriodInput = {
  productId: string;
  periodId: string;
  /** 参照日（今日・JST 暦日）。Server Action がサーバー生成して詰める。 */
  referenceDate: string;
  /** 編集画面表示時の version（楽観ロック・ADR-0039）。 */
  expectedVersion: number;
};

/**
 * 共通売単価の未来開始行を削除するコマンド（誤入力の訂正）。
 *
 * 現在有効・失効の行は過去そのもの／既発行見積が時点解決した履歴のため削除できない。状態違反は
 * 集約の不変条件が `BusinessRuleViolationError` で弾く（参照日に依存・ADR-20260627-86b）。
 */
export class DeleteCommonSellingPricePeriodCommand {
  constructor(private readonly repository: CommonSellingPriceRepository) {}

  async execute(input: DeleteCommonSellingPricePeriodInput): Promise<CommonSellingPrice> {
    const aggregate = await loadCommonSellingPriceOrThrow(this.repository, input.productId);

    aggregate.deletePeriod(new CommonSellingPricePeriodId(input.periodId), input.referenceDate);

    // 最終期間の削除で集約が空になったらルートごと削除し「空集約シェル」を残さない（#512・B案）。
    // insert/update をアプリ層で選ぶ RegisterCommand の鏡像で、集約消滅のライフサイクル遷移をここに
    // 可視化する。空シェルを残すと edit query が version:非null を返す一方 UI は0件を新規登録と見なし
    // version を送らず ValidationError で詰まるため、DB状態を用語定義「未設定＝0件」に一致させる。
    if (aggregate.isEmpty) {
      await this.repository.delete(aggregate, input.expectedVersion);
    } else {
      await this.repository.update(aggregate, input.expectedVersion);
    }
    return aggregate;
  }
}
