import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import {
  resolveUnitPriceDivergences,
  type UnitPriceDivergenceResolver,
} from "../shared/resolveUnitPriceDivergences";
import { EstimateQueryService } from "./EstimateQueryService";
import { EstimateDetailDTO, LineDTO, VariationDTO } from "./dto/EstimateDetailDTO";

export type GetEstimateDetailInput = {
  /** 見積番号（自然キー・8桁文字列。ルート [estimateNumber] から渡る）。 */
  estimateNumber: string;
};

/**
 * 見積詳細取得クエリ（Q1）。事実（保存値・read-through マスタ）の取得は PrismaEstimateQueryService に閉じ、
 * app 層で単価乖離・解決不能（→CONTEXT・#593）を合成する（ADR-20260707-ae2 の「query service は事実だけ・
 * app 層で合成」パターン）。合成は見積年月日を参照日に現在マスタで再解決した派生状態で、保存もブロックも
 * しない（ADR-20260710-fg7）。
 */
export class GetEstimateDetailQuery {
  constructor(
    private readonly estimateQueryService: EstimateQueryService,
    private readonly divergenceResolver: UnitPriceDivergenceResolver
  ) {}

  async execute(input: GetEstimateDetailInput): Promise<EstimateDetailDTO | null> {
    const dto = await this.estimateQueryService.findByEstimateNumber(input.estimateNumber);
    if (dto === null) {
      return null;
    }

    await Promise.all(dto.variations.map((variation) => this.composeDivergences(dto, variation)));
    return dto;
  }

  /**
   * 1 バリエーションの価格付き末端行（通常明細＋セット構成明細）に単価乖離・解決不能を合成する。
   * セット群行は価格を持たないため対象外・構成明細は対象（計画の判定対象）。宛先・見積年月日はヘッダ
   * 不変属性、提出区分はバリエーション固定なので、この単位でデデュープ解決すれば「提出区分×商品ID」になる。
   */
  private async composeDivergences(dto: EstimateDetailDTO, variation: VariationDTO): Promise<void> {
    const lines = collectPricedLines(variation);
    if (lines.length === 0) {
      return;
    }

    const divergences = await resolveUnitPriceDivergences(
      lines.map((line) => ({ productId: line.productId, fixedUnitPrice: line.unitPrice })),
      {
        submissionType: SubmissionType.from(variation.submissionType),
        customerId: dto.customerId,
        deliveryLocationId: dto.deliveryLocationId,
        estimateDate: dto.estimateDate,
      },
      this.divergenceResolver
    );

    lines.forEach((line, index) => {
      line.unitPriceDivergence = divergences[index];
    });
  }
}

/** バリエーションの価格付き末端行（通常明細＋セット構成明細）を表示順のまま集める。 */
function collectPricedLines(variation: VariationDTO): LineDTO[] {
  const lines: LineDTO[] = [];
  for (const entry of variation.lines) {
    if (entry.kind === "line") {
      lines.push(entry);
    } else {
      lines.push(...entry.components);
    }
  }
  return lines;
}
