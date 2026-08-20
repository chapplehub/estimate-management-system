import prisma from "@server/prisma";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { PrismaPositionRepository } from "../PrismaPositionRepository";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * PrismaPositionRepository の統合テスト（実 DB）。
 *
 * 課員の上位役割を課長級に限る検証（ADR-20260707-k4e）で必要になった
 * 「役職階層の葉判定」を主眼に据える。役職階層は 課長(POS001)→部長(POS002)
 * →本部長(POS003)→社長(POS004) の4段単一鎖（ADR-0063）で、下位役職を持たない
 * 最下段の課長（POS001）だけが葉になる。
 */
describe("PrismaPositionRepository", () => {
  let repository: PrismaPositionRepository;

  async function positionId(positionCd: string): Promise<PositionId> {
    const position = await prisma.position.findUnique({ where: { positionCd } });
    return new PositionId(position!.id);
  }

  beforeEach(() => {
    repository = new PrismaPositionRepository();
  });

  describe("isLeafPosition（役職階層の葉判定）", () => {
    it("下位役職を持たない課長（最下段）は葉である", async () => {
      const kachou = await positionId("POS001");

      await expect(repository.isLeafPosition(kachou)).resolves.toBe(true);
    });

    it("下位に課長を持つ部長は葉ではない", async () => {
      const buchou = await positionId("POS002");

      await expect(repository.isLeafPosition(buchou)).resolves.toBe(false);
    });

    it("鎖の最上段である社長は葉ではない", async () => {
      const shachou = await positionId("POS004");

      await expect(repository.isLeafPosition(shachou)).resolves.toBe(false);
    });

    it("存在しない役職は葉として扱わない（false）", async () => {
      const missing = new PositionId("00000000-0000-7000-8000-000000000000");

      await expect(repository.isLeafPosition(missing)).resolves.toBe(false);
    });
  });
});
