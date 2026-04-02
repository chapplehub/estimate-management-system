import { Position } from "@subdomains/position/domain/entities/Position";
import { PositionRepository } from "@subdomains/position/domain/repositories/PositionRepository";
import { PositionCd } from "@subdomains/position/domain/values/PositionCd";
import { PositionMapper } from "@subdomains/position/infrastructure/mappers/PositionMapper";
import prisma from "@server/prisma";

/**
 * Prismaを使用した役職リポジトリ実装
 *
 * 読み取り専用（Positionは固定マスタデータ）
 */
export class PrismaPositionRepository implements PositionRepository {
  async findById(id: string): Promise<Position | null> {
    const prismaPosition = await prisma.position.findUnique({
      where: { id },
    });

    return prismaPosition ? PositionMapper.toDomain(prismaPosition) : null;
  }

  async findByPositionCd(positionCd: PositionCd): Promise<Position | null> {
    const prismaPosition = await prisma.position.findUnique({
      where: { positionCd: positionCd.value },
    });

    return prismaPosition ? PositionMapper.toDomain(prismaPosition) : null;
  }

  async findAll(): Promise<Position[]> {
    const prismaPositions = await prisma.position.findMany({
      orderBy: { positionCd: "asc" },
    });

    return prismaPositions.map(PositionMapper.toDomain);
  }
}
