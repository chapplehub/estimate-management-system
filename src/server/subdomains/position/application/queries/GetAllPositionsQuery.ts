import { PositionDTO } from "./dto/PositionDTO";
import { PositionQueryService } from "./PositionQueryService";

/**
 * 全役職取得クエリ
 */
export class GetAllPositionsQuery {
  public constructor(private readonly positionQueryService: PositionQueryService) {}

  async execute(): Promise<PositionDTO[]> {
    return await this.positionQueryService.findAll();
  }
}
