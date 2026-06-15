import { EstimateQueryService } from "./EstimateQueryService";
import { EstimateDetailDTO } from "./dto/EstimateDetailDTO";

export type GetEstimateDetailInput = {
  /** 見積番号（自然キー・8桁文字列。ルート [estimateNumber] から渡る）。 */
  estimateNumber: string;
};

/**
 * 見積詳細取得クエリ（Q1）。product の GetProductByCodeQuery と同型の薄い委譲。
 * 読み取りロジックは PrismaEstimateQueryService に閉じる。
 */
export class GetEstimateDetailQuery {
  constructor(private readonly estimateQueryService: EstimateQueryService) {}

  async execute(input: GetEstimateDetailInput): Promise<EstimateDetailDTO | null> {
    return await this.estimateQueryService.findByEstimateNumber(input.estimateNumber);
  }
}
