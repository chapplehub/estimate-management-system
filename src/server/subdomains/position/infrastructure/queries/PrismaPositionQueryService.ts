import { PositionDTO } from "@subdomains/position/application/queries/dto/PositionDTO";
import { PositionQueryService } from "@subdomains/position/application/queries/PositionQueryService";
import prisma from "@server/prisma";

/**
 * Prismaを使用した役職クエリサービス実装
 */
export class PrismaPositionQueryService implements PositionQueryService {
  async findById(id: string): Promise<PositionDTO | null> {
    const position = await prisma.position.findUnique({
      where: { id },
      select: this.getSelectFields(),
    });

    return position ? this.toDTO(position) : null;
  }

  async findAll(): Promise<PositionDTO[]> {
    const positions = await prisma.position.findMany({
      select: this.getSelectFields(),
      orderBy: { positionCd: "asc" },
    });

    return positions.map((p) => this.toDTO(p));
  }

  private getSelectFields() {
    return {
      id: true,
      positionCd: true,
      name: true,
      superiorPositionId: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private toDTO(position: {
    id: string;
    positionCd: string;
    name: string;
    superiorPositionId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PositionDTO {
    return {
      id: position.id,
      positionCd: position.positionCd,
      name: position.name,
      superiorPositionId: position.superiorPositionId,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    };
  }
}
