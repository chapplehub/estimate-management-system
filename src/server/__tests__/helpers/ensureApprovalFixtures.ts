import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";

import { ensureEstimateFixtures, type EstimateFixtureIds } from "./ensureEstimateFixtures";

/**
 * 承認系集約（承認免除・見積申請）の永続化テストに必要な FK マスタを確実に用意し、その ID を返す。
 *
 * 見積集約のマスタ（部署・得意先・商品など）は {@link ensureEstimateFixtures} に委譲し、
 * その上に承認系専用の従業員（免除実施者など）を予約コードで冪等 upsert して積み増す。
 * 役職・役割はシードの正準マスタ（POS / ROLE 系コード）を code 引きで再利用する方針のため、ここでは
 * 生成しない（テスト側で都度引く）。対象バリエーションは実 estimate insert で本物の FK を用意する。
 */
export type ApprovalFixtureIds = {
  /** 見積集約のマスタ ID 群（対象バリエーションを作る estimate insert に使う）。 */
  estimate: EstimateFixtureIds;
  /** 承認免除を実施する従業員（予約コードで隔離）。 */
  exempterEmployeeId: string;
};

const EXEMPTER_EMPLOYEE_CD = "EMP999092";

export async function ensureApprovalFixtures(): Promise<ApprovalFixtureIds> {
  const estimate = await ensureEstimateFixtures();

  const exempter = await prisma.employee.upsert({
    where: { employeeCd: EXEMPTER_EMPLOYEE_CD },
    update: { name: "承認免除実施者" },
    create: {
      id: generateId(),
      employeeCd: EXEMPTER_EMPLOYEE_CD,
      email: "approval-exempter@example.com",
      name: "承認免除実施者",
      departmentId: estimate.departmentId,
    },
  });

  return {
    estimate,
    exempterEmployeeId: exempter.id,
  };
}
