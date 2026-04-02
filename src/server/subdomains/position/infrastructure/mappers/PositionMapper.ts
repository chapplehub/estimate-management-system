import { Position } from "@subdomains/position/domain/entities/Position";
import { PositionCd } from "@subdomains/position/domain/values/PositionCd";
import { PositionName } from "@subdomains/position/domain/values/PositionName";
import { Position as PrismaPosition } from "@generated/prisma/client";

/**
 * PositionMapper
 *
 * PrismaのPositionモデルとドメインのPositionエンティティを相互変換する。
 * Positionは固定マスタデータのため toDomain() のみ提供。
 */
export class PositionMapper {
  /**
   * Prismaモデルからドメインエンティティへ変換
   */
  static toDomain(prismaPosition: PrismaPosition): Position {
    const positionCd = new PositionCd(prismaPosition.positionCd);
    const name = new PositionName(prismaPosition.name);

    return Position.reconstruct(
      prismaPosition.id,
      positionCd,
      name,
      prismaPosition.superiorPositionId,
      prismaPosition.createdAt,
      prismaPosition.updatedAt
    );
  }
}
