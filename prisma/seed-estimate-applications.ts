/**
 * 見積申請一覧（/estimate-applications・#572）E2E 用の代表フィクスチャ。
 *
 * 状態は保存しない（ADR-0058）ため、代表状態を「終端イベント行の存在」で作り込む:
 * - PENDING: 申請＋承認ステップのみ（承認/差戻/取下なし）。承認待ち役割が既知（営業課長）。
 * - APPROVED: 申請＋全ステップに承認行。
 * - EXEMPTED: 承認免除集約（申請なし・免除者=申請者列の出自）。
 * - WITHDRAWN（かつ INACTIVE）: 申請＋取下行。バリエーションを無効化し includeInactive の検証台にする。
 *
 * 機構は Factory+Mapper+seed client（repository も UI も使えない）。5値状態の導出網羅は単体
 * （SearchEstimateApplicationsQuery.test.ts）で既済のため、ここは FE 配線の観測に足る代表数に絞る。
 * 申請日時（createdAt）は today 相対で数日ずらし、申請日レンジ検索の検証に耐える形にする
 * （ADR-20260629-3x5）。Mapper は createdAt を DB 既定に委ねて省くため、seed 側で明示上書きする。
 */
import type { PrismaClient } from "../generated/prisma/client";
import { ProductCategory } from "../generated/prisma/enums";
import { EstimateFactory } from "@subdomains/estimate/domain/entities/EstimateFactory";
import {
  EstimateApplication,
  EstimateApprovalExemption,
} from "@subdomains/estimate/domain/entities";
import { EstimateMapper } from "@subdomains/estimate/infrastructure/mappers/EstimateMapper";
import { EstimateApplicationMapper } from "@subdomains/estimate/infrastructure/mappers/approval/EstimateApplicationMapper";
import { EstimateApprovalExemptionMapper } from "@subdomains/estimate/infrastructure/mappers/approval/EstimateApprovalExemptionMapper";
import { ApprovalChainPlan } from "@subdomains/estimate/domain/values/approval/ApprovalChainPlan";
import { EstimateExemptionReason } from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { RejectionComment } from "@subdomains/estimate/domain/values/approval/RejectionComment";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { DiscountRate } from "@subdomains/estimate/domain/values/DiscountRate";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { ItemName } from "@subdomains/estimate/domain/values/ItemName";
import { Money } from "@server/shared/domain/values/Money";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { TaxRoundingType } from "@subdomains/estimate/domain/values/TaxRoundingType";
import { Unit } from "@subdomains/estimate/domain/values/Unit";

/** 申請一覧 E2E 用のシード見積番号（05011〜・既存 05001〜010 と非重複）。 */
export const SEED_APPLICATION_ESTIMATE_NUMBERS = {
  /** PENDING（V1 ACTIVE・承認待ち役割＝営業課長）。 */
  pending: "N9905011",
  /** APPROVED（V1 ACTIVE・全ステップ承認済）。 */
  approved: "N9905012",
  /** EXEMPTED（V1 ACTIVE・承認免除）。 */
  exempted: "N9905013",
  /** WITHDRAWN かつ INACTIVE（V1 無効・取下済＝includeInactive の検証台）。 */
  withdrawnInactive: "N9905014",
  /**
   * 詳細画面用リッチフィクスチャ（V1 ACTIVE）。同一バリエーションに 2 申請を積む:
   * - attempt1 = 差戻（REJECTED・差戻コメント付き）＝過去履歴
   * - attempt2 = 多段チェーン（営業課長 承認済 → 営業部長 承認待ち）＝最新申請（PENDING）
   * 過去履歴・差戻コメント・多段ステップの状態・actorName を一度に配線検証する。
   * 主役 employee2（営業本部長）は申請者でも承認待ち役割メンバーでもないため、この番号は
   * 操作動線 E2E で「操作ボタンが一切出ない純粋閲覧」の負の検証台にも使う（#575）。
   */
  richMultiStep: "N9905015",

  // --- 操作動線 E2E 用（#575・主役 employee2＝EMP000002＝営業本部長＝ROLE002）。 ---
  // いずれも終端イベントの無い PENDING 申請で、plan の承認待ち役割と申請者だけが異なる。
  /** 最終承認用（単段・承認待ち＝営業本部長）。employee2 が承認して APPROVED になる。 */
  operationApprove: "N9905016",
  /** 途中承認用（2 段・step1＝営業本部長 → step2＝社長）。employee2 が step1 を承認して途中承認。 */
  operationMidApprove: "N9905017",
  /** 差戻用（単段・承認待ち＝営業本部長）。employee2 がコメント付きで差し戻す。 */
  operationReject: "N9905018",
  /** 取下用（単段・申請者＝営業本部長・承認待ち＝社長）。employee2 が本人として取り下げる。 */
  operationWithdraw: "N9905019",
} as const;

const TAX_RATE = new TaxRate(0.1);
const TAX_ROUNDING = TaxRoundingType.ROUND_DOWN;
const ESTIMATE_DATE = new Date("2026-04-01T00:00:00.000Z");
const DEADLINE = new Date("2026-04-30T00:00:00.000Z");

const DAY_MS = 24 * 60 * 60 * 1000;

type ApplicationSeedFk = {
  customerId: string;
  deliveryLocationId: string;
  departmentId: string;
  createdBy: string;
  productId: string;
  applicantId: string;
  approverId: string;
  exemptorId: string;
  awaitingRoleId: string;
  /** 多段チェーンの 2 段目役割（営業部長）。リッチフィクスチャの step2 に使う。 */
  secondRoleId: string;
  goalPositionId: string;
  /** 操作動線 E2E の主役（EMP000002＝営業本部長）。取下フィクスチャの申請者にも使う。 */
  protagonistId: string;
  /** 営業本部長役割（ROLE002）。主役 employee2 が直接メンバーで、承認/差戻の承認待ち役割に使う。 */
  headquartersRoleId: string;
  /** 社長役割（ROLE001）。途中承認の 2 段目・取下フィクスチャの承認待ち役割に使う。 */
  presidentRoleId: string;
};

/** 申請対象の単一バリエーション見積を組み立てる（NEW・CUSTOMER・1 明細）。 */
function buildEstimate(fk: ApplicationSeedFk, estimateNumber: string, amount: number) {
  return EstimateFactory.create({
    estimateDate: ESTIMATE_DATE,
    deadline: DEADLINE,
    customerId: new CustomerId(fk.customerId),
    deliveryLocationId: new DeliveryLocationId(fk.deliveryLocationId),
    taxRate: TAX_RATE,
    taxRoundingType: TAX_ROUNDING,
    createdBy: new EmployeeId(fk.createdBy),
    departmentId: new DepartmentId(fk.departmentId),
    estimateNumber: EstimateNumber.parse(estimateNumber),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [
          {
            productId: new ProductId(fk.productId),
            sortOrder: 1,
            itemName: new ItemName("申請対象明細"),
            quantity: new Quantity(1),
            unit: new Unit("個"),
            unitPrice: Money.fromMajorUnits(amount),
            discountRate: new DiscountRate(1.0),
            revisedDeliveryPrice: null,
          },
        ],
      },
    ],
  });
}

/** 単一ステップの承認チェーン計画（承認待ち役割＝営業課長・ゴール役職は表示に出ない）。 */
function singleStepPlan(fk: ApplicationSeedFk): ApprovalChainPlan {
  return ApprovalChainPlan.create(new PositionId(fk.goalPositionId), [
    new RoleId(fk.awaitingRoleId),
  ]);
}

/** 2 段の承認チェーン計画（step1＝営業課長 → step2＝営業部長）。詳細画面の多段表示検証用。 */
function twoStepPlan(fk: ApplicationSeedFk): ApprovalChainPlan {
  return ApprovalChainPlan.create(new PositionId(fk.goalPositionId), [
    new RoleId(fk.awaitingRoleId),
    new RoleId(fk.secondRoleId),
  ]);
}

/** 承認待ち役割を差し替えられる汎用チェーン計画（操作動線 E2E 用・ゴール役職は表示に出ない）。 */
function planWithRoles(fk: ApplicationSeedFk, roleIds: string[]): ApprovalChainPlan {
  return ApprovalChainPlan.create(
    new PositionId(fk.goalPositionId),
    roleIds.map((id) => new RoleId(id))
  );
}

/**
 * 終端イベントの無い PENDING 申請を単体で投入する（操作動線 E2E 用・#575）。
 *
 * 申請者・承認待ち役割だけを差し替えて、承認/差戻/取下の各動線ごとに独立したバリエーションを作る。
 * 操作の成否は主役 employee2（営業本部長）が「承認待ち役割の直接メンバーか」「申請者本人か」で決まる。
 */
async function seedPendingApplication(
  prisma: PrismaClient,
  fk: ApplicationSeedFk,
  estimateNumber: string,
  amount: number,
  applicantEmployeeId: string,
  roleIds: string[]
): Promise<void> {
  const estimate = buildEstimate(fk, estimateNumber, amount);
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(estimate) });
  const application = EstimateApplication.create({
    variationId: estimate.variations[0].id,
    attempt: 1,
    applicantEmployeeId: new EmployeeId(applicantEmployeeId),
    plan: planWithRoles(fk, roleIds),
  });
  await prisma.estimateApplication.create({
    data: EstimateApplicationMapper.toCreateInput(application),
  });
}

/**
 * 既存の作成済みマスタ（納品先・部署・個別商品・役割・役職・従業員）を参照して、代表状態を持つ
 * 見積申請フィクスチャを投入する。FK は E2E シードの決定的コード（EMP000003〜5・営業課長）に結び、
 * 申請者名・承認待ち役割を E2E で弁別・断定できるようにする。
 */
export async function seedEstimateApplications(prisma: PrismaClient): Promise<number> {
  const deliveryLocation = await prisma.deliveryLocation.findFirst({ orderBy: { code: "asc" } });
  const department = await prisma.department.findFirst({ orderBy: { departmentCd: "asc" } });
  const product = await prisma.product.findFirst({
    where: { category: ProductCategory.INDIVIDUAL, isActive: true },
    orderBy: { code: "asc" },
  });
  // 申請者・承認者・免除者は弁別可能な既知従業員。取下は本人性ガードのため申請者と一致させる。
  const applicant = await prisma.employee.findFirst({ where: { employeeCd: "EMP000003" } }); // 佐藤 太郎
  const approver = await prisma.employee.findFirst({ where: { employeeCd: "EMP000004" } }); // 鈴木 次郎
  const exemptor = await prisma.employee.findFirst({ where: { employeeCd: "EMP000005" } }); // 高橋 三郎
  const awaitingRole = await prisma.role.findFirst({ where: { name: "営業課長" } });
  const secondRole = await prisma.role.findFirst({ where: { name: "営業部長" } });
  const goalPosition = await prisma.position.findFirst({ orderBy: { positionCd: "asc" } });
  // 操作動線 E2E の主役と役割（#575）。employee2＝EMP000002＝営業本部長＝ROLE002 の直接メンバー。
  const protagonist = await prisma.employee.findFirst({ where: { employeeCd: "EMP000002" } }); // 一般 ユーザ（営業本部長）
  const headquartersRole = await prisma.role.findFirst({ where: { name: "営業本部長" } });
  const presidentRole = await prisma.role.findFirst({ where: { name: "社長" } });

  if (
    !deliveryLocation ||
    !department ||
    !product ||
    !applicant ||
    !approver ||
    !exemptor ||
    !awaitingRole ||
    !secondRole ||
    !goalPosition ||
    !protagonist ||
    !headquartersRole ||
    !presidentRole
  ) {
    throw new Error(
      "seedEstimateApplications: 前提マスタ（納品先・部署・個別商品・EMP000002-5・役割 社長/営業本部長/営業部長/営業課長・役職）が不足しています"
    );
  }

  const fk: ApplicationSeedFk = {
    customerId: deliveryLocation.customerId,
    deliveryLocationId: deliveryLocation.id,
    departmentId: department.id,
    createdBy: applicant.id,
    productId: product.id,
    applicantId: applicant.id,
    approverId: approver.id,
    exemptorId: exemptor.id,
    awaitingRoleId: awaitingRole.id,
    secondRoleId: secondRole.id,
    goalPositionId: goalPosition.id,
    protagonistId: protagonist.id,
    headquartersRoleId: headquartersRole.id,
    presidentRoleId: presidentRole.id,
  };

  const now = Date.now();
  const daysAgo = (n: number): Date => new Date(now - n * DAY_MS);

  // --- PENDING（申請＋ステップのみ・承認待ち役割＝営業課長） ---
  const pendingEstimate = buildEstimate(fk, SEED_APPLICATION_ESTIMATE_NUMBERS.pending, 50000);
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(pendingEstimate) });
  const pendingApp = EstimateApplication.create({
    variationId: pendingEstimate.variations[0].id,
    attempt: 1,
    applicantEmployeeId: new EmployeeId(fk.applicantId),
    plan: singleStepPlan(fk),
  });
  await prisma.estimateApplication.create({
    data: { ...EstimateApplicationMapper.toCreateInput(pendingApp), createdAt: daysAgo(1) },
  });

  // --- APPROVED（申請＋全ステップ承認行） ---
  const approvedEstimate = buildEstimate(fk, SEED_APPLICATION_ESTIMATE_NUMBERS.approved, 80000);
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(approvedEstimate) });
  const approvedApp = EstimateApplication.create({
    variationId: approvedEstimate.variations[0].id,
    attempt: 1,
    applicantEmployeeId: new EmployeeId(fk.approverId),
    plan: singleStepPlan(fk),
  });
  approvedApp.approve(approvedApp.steps[0].id, new EmployeeId(fk.approverId));
  await prisma.estimateApplication.create({
    data: { ...EstimateApplicationMapper.toCreateInput(approvedApp), createdAt: daysAgo(3) },
  });
  await prisma.estimateStepApproval.createMany({
    data: EstimateApplicationMapper.toStepApprovalCreateInputs(approvedApp),
  });

  // --- EXEMPTED（承認免除・申請なし） ---
  const exemptedEstimate = buildEstimate(fk, SEED_APPLICATION_ESTIMATE_NUMBERS.exempted, 30000);
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(exemptedEstimate) });
  const exemption = EstimateApprovalExemption.create(
    exemptedEstimate.variations[0].id,
    EstimateExemptionReason.BELOW_THRESHOLD,
    new EmployeeId(fk.exemptorId)
  );
  await prisma.estimateApprovalExemption.create({
    data: { ...EstimateApprovalExemptionMapper.toCreateInput(exemption), createdAt: daysAgo(5) },
  });

  // --- WITHDRAWN かつ INACTIVE（申請＋取下行・バリエーション無効化） ---
  const withdrawnEstimate = buildEstimate(
    fk,
    SEED_APPLICATION_ESTIMATE_NUMBERS.withdrawnInactive,
    60000
  );
  withdrawnEstimate.deactivateVariation(withdrawnEstimate.variations[0].id);
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(withdrawnEstimate) });
  const withdrawnApp = EstimateApplication.create({
    variationId: withdrawnEstimate.variations[0].id,
    attempt: 1,
    applicantEmployeeId: new EmployeeId(fk.applicantId),
    plan: singleStepPlan(fk),
  });
  withdrawnApp.withdraw(new EmployeeId(fk.applicantId));
  await prisma.estimateApplication.create({
    data: { ...EstimateApplicationMapper.toCreateInput(withdrawnApp), createdAt: daysAgo(7) },
  });
  const withdrawalInput = EstimateApplicationMapper.toWithdrawalCreateInput(withdrawnApp);
  if (withdrawalInput) {
    await prisma.estimateApplicationWithdrawal.create({ data: withdrawalInput });
  }

  // --- リッチ（詳細画面用・同一バリエーションに attempt1 差戻 → attempt2 多段 PENDING） ---
  const richEstimate = buildEstimate(fk, SEED_APPLICATION_ESTIMATE_NUMBERS.richMultiStep, 120000);
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(richEstimate) });
  const richVariationId = richEstimate.variations[0].id;

  // attempt1: 単段チェーンを営業課長が差し戻す（差戻コメント付き＝過去履歴で読む対象）。
  const rejectedApp = EstimateApplication.create({
    variationId: richVariationId,
    attempt: 1,
    applicantEmployeeId: new EmployeeId(fk.applicantId),
    plan: singleStepPlan(fk),
  });
  rejectedApp.reject(
    rejectedApp.steps[0].id,
    new EmployeeId(fk.approverId),
    new RejectionComment("金額の根拠資料を添付してください")
  );
  await prisma.estimateApplication.create({
    data: { ...EstimateApplicationMapper.toCreateInput(rejectedApp), createdAt: daysAgo(4) },
  });
  await prisma.estimateStepRejection.createMany({
    data: EstimateApplicationMapper.toStepRejectionCreateInputs(rejectedApp),
  });

  // attempt2: 2 段チェーン（営業課長 → 営業部長）。課長のみ承認済＝部長が承認待ちの PENDING。
  const pendingChainApp = EstimateApplication.create({
    variationId: richVariationId,
    attempt: 2,
    applicantEmployeeId: new EmployeeId(fk.applicantId),
    plan: twoStepPlan(fk),
  });
  pendingChainApp.approve(pendingChainApp.steps[0].id, new EmployeeId(fk.approverId));
  await prisma.estimateApplication.create({
    data: { ...EstimateApplicationMapper.toCreateInput(pendingChainApp), createdAt: daysAgo(2) },
  });
  await prisma.estimateStepApproval.createMany({
    data: EstimateApplicationMapper.toStepApprovalCreateInputs(pendingChainApp),
  });

  // --- 操作動線 E2E 用の 4 フィクスチャ（#575・主役 employee2＝営業本部長）。 ---
  // いずれも PENDING（終端イベントなし）。承認待ち役割と申請者だけで employee2 の操作可否を切り替える。

  // 1. 最終承認用: 単段・承認待ち＝営業本部長。employee2 が承認すると全ステップ承認済＝APPROVED。
  await seedPendingApplication(
    prisma,
    fk,
    SEED_APPLICATION_ESTIMATE_NUMBERS.operationApprove,
    50000,
    fk.applicantId,
    [fk.headquartersRoleId]
  );

  // 2. 途中承認用: 2 段（step1＝営業本部長 → step2＝社長）。employee2 が step1 を承認しても
  //    社長ステップが承認待ちで残り、申請は PENDING のまま（途中承認）。
  await seedPendingApplication(
    prisma,
    fk,
    SEED_APPLICATION_ESTIMATE_NUMBERS.operationMidApprove,
    70000,
    fk.applicantId,
    [fk.headquartersRoleId, fk.presidentRoleId]
  );

  // 3. 差戻用: 単段・承認待ち＝営業本部長。employee2 がコメント付きで差し戻す。
  await seedPendingApplication(
    prisma,
    fk,
    SEED_APPLICATION_ESTIMATE_NUMBERS.operationReject,
    90000,
    fk.applicantId,
    [fk.headquartersRoleId]
  );

  // 4. 取下用: 単段・申請者＝営業本部長（本人）・承認待ち＝社長（employee2 は非メンバー）。
  //    employee2 は申請者本人として取下でき、承認/差戻ボタンは出ない。
  await seedPendingApplication(
    prisma,
    fk,
    SEED_APPLICATION_ESTIMATE_NUMBERS.operationWithdraw,
    110000,
    fk.protagonistId,
    [fk.presidentRoleId]
  );

  return Object.keys(SEED_APPLICATION_ESTIMATE_NUMBERS).length;
}
