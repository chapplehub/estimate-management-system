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

  // 承認者を全ステップ役割のメンバー（EmployeeRole）に登録する（承認/差戻ユースケースの
  // 個人認可検証・#418）。承認者本人が当該役割のメンバーになることで hasMember=true となる。
  // シード役割は既にメンバーを持つため「メンバー有無」判定は変わらず、承認チェーン構築
  // （NO_APPROVER 検出）への影響はない。複合 PK のため skipDuplicates で冪等化する。
  await prisma.employeeRole.createMany({
    data: stepRoles.map((role) => ({ employeeId: approver.id, roleId: role.id })),
    skipDuplicates: true,
  });

  return {
    estimate,
    exempterEmployeeId: exempter.id,
    applicantEmployeeId: applicant.id,
    approverEmployeeId: approver.id,
    goalPositionId: goalPosition.id,
    stepRoleIds: stepRoles.map((r) => r.id),
  };
}

/**
 * 指定見積番号に紐づく承認系テストデータを FK 安全な順序で削除する（免除・申請テスト共有）。
 *
 * 承認系の各表はすべて Restrict FK のため、内側（イベント → ステップ → 申請／免除）から
 * estimate へ向けて削除する。免除・申請のどちらか一方しか作っていないケースでも、各 deleteMany は
 * 対象ゼロなら no-op で安全に通る（上位集合として両系統を網羅する）。
 */
export async function cleanupApprovalFixtures(estimateNumbers: readonly string[]): Promise<void> {
  const numbers = [...estimateNumbers];
  const estimates = await prisma.estimate.findMany({
    where: { estimateNumber: { in: numbers } },
    select: { variations: { select: { id: true } } },
  });
  const variationIds = estimates.flatMap((e) => e.variations.map((v) => v.id));

  if (variationIds.length > 0) {
    // 承認免除（variation を Restrict FK 参照）。
    await prisma.estimateApprovalExemption.deleteMany({
      where: { variationId: { in: variationIds } },
    });

    // 申請 → ステップ → 各イベント（すべて Restrict FK のため内側から削除する）。
    const applications = await prisma.estimateApplication.findMany({
      where: { variationId: { in: variationIds } },
      select: { id: true, steps: { select: { id: true } } },
    });
    const applicationIds = applications.map((a) => a.id);
    const stepIds = applications.flatMap((a) => a.steps.map((s) => s.id));

    if (stepIds.length > 0) {
      await prisma.estimateStepApproval.deleteMany({ where: { stepId: { in: stepIds } } });
      await prisma.estimateStepRejection.deleteMany({ where: { stepId: { in: stepIds } } });
    }
    if (applicationIds.length > 0) {
      await prisma.estimateApplicationWithdrawal.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      await prisma.estimateApprovalStep.deleteMany({
        where: { applicationId: { in: applicationIds } },
      });
      await prisma.estimateApplication.deleteMany({ where: { id: { in: applicationIds } } });
    }
  }

  await prisma.estimate.deleteMany({ where: { estimateNumber: { in: numbers } } });
}
