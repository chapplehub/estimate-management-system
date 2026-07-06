import { VariationApplicationStateQueryService } from "./VariationApplicationStateQueryService";
import { VariationApplicationStateDTO } from "./dto/VariationApplicationStateDTO";

export type GetVariationApplicationStatesInput = {
  /** 見積 ID（UUID・ルートから渡る）。 */
  estimateId: string;
};

/**
 * バリエーション別 申請状態参照クエリ（見積詳細画面 S2・#493）。
 *
 * 「申請ボタン出し分け」と「バリエーション別バッジ」を駆動する。GetEstimateDetailQuery と同型の
 * 薄い委譲で、読み取りロジック（Prisma 直読み＋ドメイン共有関数での還元）は
 * PrismaVariationApplicationStateQueryService に閉じる。
 */
export class GetVariationApplicationStatesQuery {
  constructor(private readonly queryService: VariationApplicationStateQueryService) {}

  async execute(
    input: GetVariationApplicationStatesInput
  ): Promise<VariationApplicationStateDTO[]> {
    return this.queryService.findByEstimateId(input.estimateId);
  }
}
