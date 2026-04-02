import { PositionDTO } from "./dto/PositionDTO";
import { PositionQueryService } from "./PositionQueryService";

export type GetPositionByIdInput = {
  id: string;
};

/**
 * ID指定役職取得クエリ
 */
export class GetPositionByIdQuery {
  public constructor(private readonly positionQueryService: PositionQueryService) {}

  async execute(input: GetPositionByIdInput): Promise<PositionDTO | null> {
    return await this.positionQueryService.findById(input.id);
  }
}
