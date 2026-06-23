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
  /** 申請者（予約コードで隔離）。 */
  applicantEmployeeId: string;
  /** 承認・差戻を実施する従業員（予約コードで隔離）。 */
  approverEmployeeId: string;
  /** 承認チェーンのゴール役職（部長 = POS002・シード再利用）。 */
  goalPositionId: string;
  /** 承認ステップの順序付き役割列（営業一課長 → 営業部長・シード再利用）。 */
  stepRoleIds: string[];
};

const EXEMPTER_EMPLOYEE_CD = "EMP999092";
const APPLICANT_EMPLOYEE_CD = "EMP999093";
const APPROVER_EMPLOYEE_CD = "EMP999094";

// 承認チェーンに使うシードの正準組織（code 引きで再利用）。
const GOAL_POSITION_CD = "POS002"; // 部長
const STEP_ROLE_CDS = ["ROLE009", "ROLE004"] as const; // 営業一課長 → 営業部長

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

  const applicant = await prisma.employee.upsert({
    where: { employeeCd: APPLICANT_EMPLOYEE_CD },
    update: { name: "申請者" },
    create: {
      id: generateId(),
      employeeCd: APPLICANT_EMPLOYEE_CD,
      email: "approval-applicant@example.com",
      name: "申請者",
      departmentId: estimate.departmentId,
    },
  });

  const approver = await prisma.employee.upsert({
    where: { employeeCd: APPROVER_EMPLOYEE_CD },
    update: { name: "承認者" },
    create: {
      id: generateId(),
      employeeCd: APPROVER_EMPLOYEE_CD,
      email: "approval-approver@example.com",
      name: "承認者",
      departmentId: estimate.departmentId,
    },
  });

  // 役職・役割はシードの固定マスタを code 引きで再利用する（@unique がテスト専用生成を阻むため）。
  const goalPosition = await prisma.position.findUniqueOrThrow({
    where: { positionCd: GOAL_POSITION_CD },
  });
  const stepRoles = await Promise.all(
    STEP_ROLE_CDS.map((roleCd) => prisma.role.findUniqueOrThrow({ where: { roleCd } }))
  );

  return {
    estimate,
    exempterEmployeeId: exempter.id,
    applicantEmployeeId: applicant.id,
    approverEmployeeId: approver.id,
    goalPositionId: goalPosition.id,
    stepRoleIds: stepRoles.map((r) => r.id),
  };
}
