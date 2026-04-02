import { PositionRepository } from "@subdomains/role/domain/repositories/PositionRepository";
import prisma from "@server/prisma";

/**
 * Roleドメイン用のPrisma役職リポジトリ実装
 *
 * Roleドメインの PositionRepository インターフェースを実装する。
 * 上位役割バリデーションに必要な最小限のメソッドのみ提供。
 */
export class PrismaPositionRepository implements PositionRepository {
  async findSuperiorPositionId(positionId: string): Promise<string | null> {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      select: { superiorPositionId: true },
    });

    // 役職が見つからない場合は null を返す
    return position?.superiorPositionId ?? null;
  }

  async exists(positionId: string): Promise<boolean> {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      select: { id: true },
    });

    return position !== null;
  }
}
