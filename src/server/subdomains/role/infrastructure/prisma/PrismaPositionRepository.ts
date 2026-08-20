import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { PositionRepository } from "@subdomains/role/domain/repositories/PositionRepository";
import prisma from "@server/prisma";

/**
 * Roleドメイン用のPrisma役職リポジトリ実装
 *
 * Roleドメインの PositionRepository インターフェースを実装する。
 * 上位役割バリデーションに必要な最小限のメソッドのみ提供。
 */
export class PrismaPositionRepository implements PositionRepository {
  async findSuperiorPositionId(positionId: PositionId): Promise<PositionId | null> {
    const position = await prisma.position.findUnique({
      where: { id: positionId.value },
      select: { superiorPositionId: true },
    });

    // 役職が見つからない場合は null を返す
    const superiorId = position?.superiorPositionId ?? null;
    return superiorId ? new PositionId(superiorId) : null;
  }

  async exists(positionId: PositionId): Promise<boolean> {
    const position = await prisma.position.findUnique({
      where: { id: positionId.value },
      select: { id: true },
    });

    return position !== null;
  }

  async isLeafPosition(positionId: PositionId): Promise<boolean> {
    // 存在しない役職は葉として扱わない（誤って課長級判定を通さないため）
    if (!(await this.exists(positionId))) {
      return false;
    }

    // 「自分を上位役職に持つ行」＝下位役職。1件でもあれば葉ではない
    const subordinateCount = await prisma.position.count({
      where: { superiorPositionId: positionId.value },
    });

    return subordinateCount === 0;
  }
}
