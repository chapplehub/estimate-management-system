import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateItemId } from "@subdomains/estimate/domain/values/EstimateItemId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { Memo } from "@subdomains/estimate/domain/values/Memo";

/** 明細単位のメモ更新入力。空文字・未指定は空 Memo に正規化される。 */
export type ItemMemoInput = {
  itemId: string;
  customerMemo?: string;
  internalMemo?: string;
};

/**
 * メモのみ更新コマンドの入力（改訂元の凍結を貫通する唯一の編集経路・ADR-0059）。
 *
 * 集約は estimateId からのみロードできるため対象特定に variationId を併せて受け取る。
 * メモはすべて任意項目で、未指定/空文字は Memo.create が空 Memo に正規化する（ADR-0034）。
 */
export type UpdateVariationMemosInput = {
  estimateId: string;
  variationId: string;
  /** 編集画面表示時に取得した親見積の楽観ロックトークン（ADR-0039）。フォーム往復で持ち回る */
  version: number;
  customerMemo?: string;
  internalMemo?: string;
  itemMemos: ItemMemoInput[];
};

/**
 * メモのみ更新コマンド（改訂元の凍結貫通・ADR-0059）。
 *
 * 流れ: 既存集約をロード → ルート changeVariationMemos / changeItemMemos でバリ単位・
 * 明細単位の顧客/社内メモを適用 → version 付きで保存。メモは金額・税額に影響しないため、
 * 税率整合チェック（checkTaxRateThenSave／§8.6・§8.7）を通さない素の update とする
 * （ADR-0049 が守る「凍結バリの税額再計算が起きない前提」と整合）。予測可能な業務分岐
 * （税率不一致）が無いため戻り値は Result でなく保存済み集約そのもの（ADR-0037）。
 *
 * 見積不在は NotFoundEntityError。凍結（改訂元）でもドメインが findVariationOrThrow
 * 経由で貫通するため成功する。
 */
export class UpdateVariationMemosCommand {
  constructor(private readonly estimateRepository: EstimateRepository) {}

  async execute(input: UpdateVariationMemosInput): Promise<Estimate> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    const variationId = new EstimateVariationId(input.variationId);
    estimate.changeVariationMemos(
      variationId,
      Memo.create(input.customerMemo),
      Memo.create(input.internalMemo)
    );
    for (const memo of input.itemMemos) {
      estimate.changeItemMemos(
        variationId,
        new EstimateItemId(memo.itemId),
        Memo.create(memo.customerMemo),
        Memo.create(memo.internalMemo)
      );
    }

    return this.estimateRepository.update(estimate, input.version);
  }
}
