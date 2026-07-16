/**
 * 開発 seed 専用の「見積申請状態」フィクスチャ（#591）。
 *
 * 申請一覧（/estimate-applications）を手動確認・デモできるよう、5 状態（PENDING/APPROVED/
 * REJECTED/WITHDRAWN/EXEMPTED）を各最低 5 件、検索 8 軸（見積番号・得意先名・納品先名・状態・
 * 申請者名・承認待ち役割・申請日時レンジ・includeInactive）すべてで「絞ると結果が変わる」分布に置く。
 *
 * 状態は保存しない（ADR-0058）ため、終端イベント行の有無で作り分ける:
 *  - PENDING  : 申請＋ステップのみ（承認/差戻/取下なし）。承認待ち役割＝先頭の未承認ステップの役割。
 *  - APPROVED : 全ステップに承認行。
 *  - REJECTED : いずれかのステップに差戻行（前段は承認してから当該段を差し戻す）。
 *  - WITHDRAWN: 取下行（申請者本人・§7.3）。無効バリと組み合わせ includeInactive の検証台にする。
 *  - EXEMPTED : 承認免除集約（申請なし・免除者＝申請者列の出自）。免除 3 理由をそれぞれ収録。
 *
 * リッチケース: 同一バリエーションに attempt1 差戻 → attempt2 途中承認 PENDING を積む（詳細画面用）。
 *
 * 機構は共有 seed 踏襲: EstimateFactory→Mapper→seed 専用 PrismaClient（repository も UI も使えない）。
 * 申請日時（createdAt）は today 相対で過去 90 日に分散（ADR-20260629-3x5）。Mapper は createdAt を
 * DB 既定に委ねるため seed 側で明示上書きする。FK は dev の決定的コード（PRD/D コード・固定名）へ結合。
 *
 * 見積番号帯: N9906101〜/A99061xx（連番 061xx）。ドラフト（06001〜06022）・e2e（05xxx）と非重複。
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { EstimateFactory } from "@subdomains/estimate/domain/entities/EstimateFactory";
import {
  EstimateApplication,
  EstimateApprovalExemption,
} from "@subdomains/estimate/domain/entities";
import { EstimateMapper } from "@subdomains/estimate/infrastructure/mappers/EstimateMapper";
import { EstimateApplicationMapper } from "@subdomains/estimate/infrastructure/mappers/approval/EstimateApplicationMapper";
import { EstimateApprovalExemptionMapper } from "@subdomains/estimate/infrastructure/mappers/approval/EstimateApprovalExemptionMapper";
import { ApprovalChainPlan } from "@subdomains/estimate/domain/values/approval/ApprovalChainPlan";
import {
  EstimateExemptionReason,
  type EstimateExemptionReasonCode,
} from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { RejectionComment } from "@subdomains/estimate/domain/values/approval/RejectionComment";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { DiscountRate } from "@subdomains/estimate/domain/values/DiscountRate";
import { EmergencyReason } from "@subdomains/estimate/domain/values/approval/EmergencyReason";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { FaultDescription } from "@subdomains/estimate/domain/values/FaultDescription";
import { ItemName } from "@subdomains/estimate/domain/values/ItemName";
import { Money } from "@server/shared/domain/values/Money";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { TaxRoundingType } from "@subdomains/estimate/domain/values/TaxRoundingType";
import { Unit } from "@subdomains/estimate/domain/values/Unit";

const TAX_RATE = new TaxRate(0.1);
const TAX_ROUNDING = TaxRoundingType.ROUND_DOWN;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 承認チェーン（起点課長→ゴールまで順序付き役割列）。roleCds の末尾がゴール役割で、
 * その役職を finalApprovalPositionId に採る。承認待ち役割は「先頭の未承認ステップの役割」なので、
 * PENDING を何段承認済みにするか（approveUpTo）で承認待ち役割を弁別的にずらせる。
 */
const CHAINS = {
  eigyo1Sec: ["ROLE009"], // 営業一課長（課長ゴール）
  eigyo1Dep: ["ROLE009", "ROLE004"], // 営業一課長→営業部長（部長ゴール）
  eigyo1Div: ["ROLE009", "ROLE004", "ROLE002"], // →営業本部長（本部長ゴール）
  eigyo1Pres: ["ROLE009", "ROLE004", "ROLE002", "ROLE001"], // →社長（社長ゴール・4段）
  eigyo2Sec: ["ROLE010"], // 営業二課長（課長ゴール）
  mfgSec: ["ROLE018"], // 製造一課長（課長ゴール・並行チェーン）
  mfgDep: ["ROLE018", "ROLE017"], // 製造一課長→製造部長
  mfgDiv: ["ROLE018", "ROLE017", "ROLE016"], // →製造本部長
} as const;

/** 申請系フィクスチャ（PENDING/APPROVED/REJECTED/WITHDRAWN）の宣言的定義。 */
type AppSpec = {
  number: string;
  /** 納品先コード（得意先はここから解決）。得意先名／納品先名の検索軸を弁別する。 */
  deliveryCode: string;
  /** 申請者（＝見積作成者）の従業員名。申請者名の検索軸を弁別する。 */
  applicantName: string;
  /** 税抜単価（数量 1）。 */
  amount: number;
  /** 申請日時（createdAt）を today からさかのぼる日数。0〜90 に分散する。 */
  daysAgo: number;
  chain: readonly string[];
  kind: "pending" | "approved" | "rejected" | "withdrawn";
  /** PENDING の途中承認: 先頭から何段を承認済みにするか（承認待ち役割＝chain[approveUpTo]）。 */
  approveUpTo?: number;
  /** REJECTED: 差し戻すステップ index（前段は承認してから当該段を差戻）。既定 0。 */
  rejectAt?: number;
  /** 差戻コメント（REJECTED 必須）。 */
  comment?: string;
  /** バリエーションを無効化（includeInactive の検証台）。 */
  inactive?: boolean;
};

/** 免除系フィクスチャ（EXEMPTED）の宣言的定義。免除者＝申請者。 */
type ExemptSpec = {
  number: string;
  deliveryCode: string;
  applicantName: string;
  amount: number;
  daysAgo: number;
  reason: EstimateExemptionReasonCode;
  inactive?: boolean;
};

// --- PENDING（申請＋ステップのみ）。承認待ち役割・申請者・得意先・日付を弁別的に分散する。 ---
const PENDING_SPECS: AppSpec[] = [
  // 新規申請（未承認・承認待ち役割＝chain 先頭）。
  {
    number: "N9906101",
    deliveryCode: "D001",
    applicantName: "営業 課員",
    amount: 300000,
    daysAgo: 1,
    chain: CHAINS.eigyo1Sec,
    kind: "pending",
  }, // 承認待ち: 営業一課長
  {
    number: "N9906102",
    deliveryCode: "D003",
    applicantName: "営業 課員",
    amount: 2000000,
    daysAgo: 2,
    chain: CHAINS.eigyo1Dep,
    kind: "pending",
  }, // 承認待ち: 営業一課長
  {
    number: "N9906103",
    deliveryCode: "D006",
    applicantName: "製造 課員",
    amount: 300000,
    daysAgo: 4,
    chain: CHAINS.mfgSec,
    kind: "pending",
  }, // 承認待ち: 製造一課長
  {
    number: "N9906104",
    deliveryCode: "D011",
    applicantName: "製造 課員",
    amount: 2000000,
    daysAgo: 6,
    chain: CHAINS.mfgDep,
    kind: "pending",
  }, // 承認待ち: 製造一課長
  {
    number: "N9906105",
    deliveryCode: "D013",
    applicantName: "加藤 十郎",
    amount: 300000,
    daysAgo: 9,
    chain: CHAINS.eigyo2Sec,
    kind: "pending",
  }, // 承認待ち: 営業二課長
  {
    number: "N9906106",
    deliveryCode: "D018",
    applicantName: "営業 課員",
    amount: 32000000,
    daysAgo: 13,
    chain: CHAINS.eigyo1Pres,
    kind: "pending",
  }, // 承認待ち: 営業一課長
  {
    number: "N9906107",
    deliveryCode: "D034",
    applicantName: "製造 課員",
    amount: 15000000,
    daysAgo: 18,
    chain: CHAINS.mfgDiv,
    kind: "pending",
  }, // 承認待ち: 製造一課長
  {
    number: "N9906112",
    deliveryCode: "D005",
    applicantName: "営業 課員",
    amount: 300000,
    daysAgo: 0,
    chain: CHAINS.eigyo1Sec,
    kind: "pending",
  }, // 本日申請（レンジ検索の下端）
  // 途中承認（前段承認済み・承認待ち役割＝chain[approveUpTo]）。
  {
    number: "N9906108",
    deliveryCode: "D022",
    applicantName: "営業 課員",
    amount: 2000000,
    daysAgo: 3,
    chain: CHAINS.eigyo1Dep,
    kind: "pending",
    approveUpTo: 1,
  }, // 承認待ち: 営業部長
  {
    number: "N9906109",
    deliveryCode: "D025",
    applicantName: "営業 課員",
    amount: 15000000,
    daysAgo: 5,
    chain: CHAINS.eigyo1Div,
    kind: "pending",
    approveUpTo: 2,
  }, // 承認待ち: 営業本部長
  {
    number: "N9906110",
    deliveryCode: "D029",
    applicantName: "製造 課員",
    amount: 15000000,
    daysAgo: 8,
    chain: CHAINS.mfgDiv,
    kind: "pending",
    approveUpTo: 1,
  }, // 承認待ち: 製造部長
  {
    number: "N9906111",
    deliveryCode: "D008",
    applicantName: "営業 課員",
    amount: 32000000,
    daysAgo: 11,
    chain: CHAINS.eigyo1Pres,
    kind: "pending",
    approveUpTo: 3,
  }, // 承認待ち: 社長
];

// --- APPROVED（全ステップ承認行）。 ---
const APPROVED_SPECS: AppSpec[] = [
  {
    number: "N9906120",
    deliveryCode: "D001",
    applicantName: "営業 課員",
    amount: 300000,
    daysAgo: 7,
    chain: CHAINS.eigyo1Sec,
    kind: "approved",
  },
  {
    number: "N9906121",
    deliveryCode: "D003",
    applicantName: "営業 課員",
    amount: 2000000,
    daysAgo: 10,
    chain: CHAINS.eigyo1Dep,
    kind: "approved",
  },
  {
    number: "N9906122",
    deliveryCode: "D006",
    applicantName: "製造 課員",
    amount: 300000,
    daysAgo: 14,
    chain: CHAINS.mfgSec,
    kind: "approved",
  },
  {
    number: "N9906123",
    deliveryCode: "D011",
    applicantName: "営業 課員",
    amount: 15000000,
    daysAgo: 20,
    chain: CHAINS.eigyo1Div,
    kind: "approved",
  },
  {
    number: "N9906124",
    deliveryCode: "D018",
    applicantName: "加藤 十郎",
    amount: 300000,
    daysAgo: 28,
    chain: CHAINS.eigyo2Sec,
    kind: "approved",
  },
  {
    number: "N9906125",
    deliveryCode: "D034",
    applicantName: "営業 課員",
    amount: 32000000,
    daysAgo: 40,
    chain: CHAINS.eigyo1Pres,
    kind: "approved",
  },
  {
    number: "N9906126",
    deliveryCode: "D022",
    applicantName: "製造 課員",
    amount: 2000000,
    daysAgo: 55,
    chain: CHAINS.mfgDep,
    kind: "approved",
  },
  {
    number: "N9906127",
    deliveryCode: "D016",
    applicantName: "製造 課員",
    amount: 300000,
    daysAgo: 88,
    chain: CHAINS.mfgSec,
    kind: "approved",
  }, // レンジ検索の上端付近
];

// --- REJECTED（差戻行・前段は承認済み）。差戻段を分散し「どの役割が差し戻したか」を弁別する。 ---
const REJECTED_SPECS: AppSpec[] = [
  {
    number: "N9906130",
    deliveryCode: "D001",
    applicantName: "営業 課員",
    amount: 300000,
    daysAgo: 2,
    chain: CHAINS.eigyo1Sec,
    kind: "rejected",
    rejectAt: 0,
    comment: "金額の根拠資料を添付してください",
  },
  {
    number: "N9906131",
    deliveryCode: "D003",
    applicantName: "営業 課員",
    amount: 2000000,
    daysAgo: 6,
    chain: CHAINS.eigyo1Dep,
    kind: "rejected",
    rejectAt: 0,
    comment: "課長判断: 仕様の確認が先に必要です",
  },
  {
    number: "N9906132",
    deliveryCode: "D006",
    applicantName: "営業 課員",
    amount: 2000000,
    daysAgo: 9,
    chain: CHAINS.eigyo1Dep,
    kind: "rejected",
    rejectAt: 1,
    comment: "部長判断: 値引率を見直してください",
  }, // 課長承認済→部長差戻
  {
    number: "N9906133",
    deliveryCode: "D011",
    applicantName: "製造 課員",
    amount: 300000,
    daysAgo: 16,
    chain: CHAINS.mfgSec,
    kind: "rejected",
    rejectAt: 0,
    comment: "納期が非現実的です",
  },
  {
    number: "N9906134",
    deliveryCode: "D025",
    applicantName: "営業 課員",
    amount: 15000000,
    daysAgo: 25,
    chain: CHAINS.eigyo1Div,
    kind: "rejected",
    rejectAt: 2,
    comment: "本部長判断: 稟議書を添付のこと",
  }, // 課長部長承認済→本部長差戻
  {
    number: "N9906135",
    deliveryCode: "D029",
    applicantName: "加藤 十郎",
    amount: 300000,
    daysAgo: 45,
    chain: CHAINS.eigyo2Sec,
    kind: "rejected",
    rejectAt: 0,
    comment: "得意先与信を再確認してください",
  },
];

// --- WITHDRAWN（取下行・申請者本人）。無効バリを混ぜ includeInactive を弁別する。 ---
const WITHDRAWN_SPECS: AppSpec[] = [
  {
    number: "N9906140",
    deliveryCode: "D001",
    applicantName: "営業 課員",
    amount: 300000,
    daysAgo: 3,
    chain: CHAINS.eigyo1Sec,
    kind: "withdrawn",
  },
  {
    number: "N9906141",
    deliveryCode: "D003",
    applicantName: "営業 課員",
    amount: 2000000,
    daysAgo: 6,
    chain: CHAINS.eigyo1Dep,
    kind: "withdrawn",
    inactive: true,
  },
  {
    number: "N9906142",
    deliveryCode: "D006",
    applicantName: "製造 課員",
    amount: 300000,
    daysAgo: 12,
    chain: CHAINS.mfgSec,
    kind: "withdrawn",
  },
  {
    number: "N9906143",
    deliveryCode: "D013",
    applicantName: "営業 課員",
    amount: 15000000,
    daysAgo: 30,
    chain: CHAINS.eigyo1Div,
    kind: "withdrawn",
    inactive: true,
  },
  {
    number: "N9906144",
    deliveryCode: "D018",
    applicantName: "加藤 十郎",
    amount: 300000,
    daysAgo: 50,
    chain: CHAINS.eigyo2Sec,
    kind: "withdrawn",
  },
  {
    number: "N9906145",
    deliveryCode: "D032",
    applicantName: "営業 課員",
    amount: 2000000,
    daysAgo: 90,
    chain: CHAINS.eigyo1Dep,
    kind: "withdrawn",
  }, // レンジ検索の上端
];

// --- EXEMPTED（免除集約・申請なし）。免除 3 理由をそれぞれ収録。無効バリも 1 件混ぜる。 ---
const EXEMPT_SPECS: ExemptSpec[] = [
  {
    number: "N9906150",
    deliveryCode: "D001",
    applicantName: "営業 課員",
    amount: 50000,
    daysAgo: 1,
    reason: "BELOW_THRESHOLD",
  }, // 税込55,000 < 10万
  {
    number: "N9906151",
    deliveryCode: "D003",
    applicantName: "営業 課員",
    amount: 5000,
    daysAgo: 4,
    reason: "CONSUMABLE_ONLY",
  }, // 消耗品のみ（金額無関係）
  {
    number: "A9906110",
    deliveryCode: "D006",
    applicantName: "営業 課員",
    amount: 300000,
    daysAgo: 9,
    reason: "AFTER_REPAIR",
  }, // 事後見積（A接頭辞）
  {
    number: "N9906152",
    deliveryCode: "D011",
    applicantName: "製造 課員",
    amount: 50000,
    daysAgo: 17,
    reason: "BELOW_THRESHOLD",
  },
  {
    number: "N9906153",
    deliveryCode: "D022",
    applicantName: "製造 課員",
    amount: 5000,
    daysAgo: 33,
    reason: "CONSUMABLE_ONLY",
    inactive: true,
  },
  {
    number: "A9906111",
    deliveryCode: "D034",
    applicantName: "営業 課員",
    amount: 300000,
    daysAgo: 60,
    reason: "AFTER_REPAIR",
  },
  {
    number: "N9906154",
    deliveryCode: "D025",
    applicantName: "加藤 十郎",
    amount: 50000,
    daysAgo: 75,
    reason: "BELOW_THRESHOLD",
  },
];

const REASON_VO: Record<EstimateExemptionReasonCode, EstimateExemptionReason> = {
  BELOW_THRESHOLD: EstimateExemptionReason.BELOW_THRESHOLD,
  CONSUMABLE_ONLY: EstimateExemptionReason.CONSUMABLE_ONLY,
  AFTER_REPAIR: EstimateExemptionReason.AFTER_REPAIR,
};

/** 免除・申請フィクスチャが参照する固定 FK（呼び出し側 seed の作成済みデータから解決）。 */
type ApplicationFk = {
  departmentId: string;
  /** 通常明細用の個別商品（PRD002）。 */
  individualId: string;
  /** 消耗品（消耗品のみ免除用・PRD029）。 */
  consumableId: string;
  /** 修理/事後修理の対象商品（PRD014）。 */
  repairTargetId: string;
};

export async function seedDevApplications(prisma: PrismaClient): Promise<number> {
  // 参照する商品コードを 1 回の findMany でまとめて解決する（納品先・申請者の IN 一括取得と同じ方針）。
  const productCodes = ["PRD002", "PRD029", "PRD014"];
  const productIdByCode = new Map(
    (
      await prisma.product.findMany({
        where: { code: { in: productCodes } },
        select: { id: true, code: true },
      })
    ).map((p) => [p.code, p.id])
  );
  const findProduct = (code: string): string => {
    const id = productIdByCode.get(code);
    if (!id) throw new Error(`seedDevApplications: 商品 ${code} が見つかりません`);
    return id;
  };
  const department = await prisma.department.findFirst({ where: { departmentCd: "DEPT001" } });
  if (!department) {
    throw new Error("seedDevApplications: 部署 DEPT001 が不足しています");
  }

  const fk: ApplicationFk = {
    departmentId: department.id,
    individualId: findProduct("PRD002"),
    consumableId: findProduct("PRD029"),
    repairTargetId: findProduct("PRD014"),
  };

  // 役割: roleCd → {id, positionId}（ゴール役職の解決と役割 ID 参照に使う）。
  const roles = await prisma.role.findMany({
    select: { id: true, roleCd: true, positionId: true },
  });
  const roleByCd = new Map(roles.map((r) => [r.roleCd, { id: r.id, positionId: r.positionId }]));
  const roleCdById = new Map(roles.map((r) => [r.id, r.roleCd]));

  // 承認待ち役割のメンバー（roleCd → 従業員 ID）。承認・差戻の actor に充てて画面表示を現実的にする。
  const employeeRoles = await prisma.employeeRole.findMany({
    select: { employeeId: true, roleId: true },
  });
  const memberByRoleCd = new Map<string, string>();
  for (const er of employeeRoles) {
    const cd = roleCdById.get(er.roleId);
    if (cd && !memberByRoleCd.has(cd)) memberByRoleCd.set(cd, er.employeeId);
  }

  // 納品先: code → {id, customerId}。
  const deliveryCodes = [
    ...new Set(
      [
        ...PENDING_SPECS,
        ...APPROVED_SPECS,
        ...REJECTED_SPECS,
        ...WITHDRAWN_SPECS,
        ...EXEMPT_SPECS,
        { deliveryCode: "D001" }, // リッチケース用
      ].map((s) => s.deliveryCode)
    ),
  ];
  const deliveries = await prisma.deliveryLocation.findMany({
    where: { code: { in: deliveryCodes } },
    select: { id: true, code: true, customerId: true },
  });
  const deliveryByCode = new Map(deliveries.map((d) => [d.code, d]));

  // 申請者: name → 従業員 ID（固定アカウント名は決定的・ランダム名プールと非重複）。
  const applicantNames = [
    ...new Set(
      [
        ...PENDING_SPECS,
        ...APPROVED_SPECS,
        ...REJECTED_SPECS,
        ...WITHDRAWN_SPECS,
        ...EXEMPT_SPECS,
        { applicantName: "営業 課員" }, // リッチケース用
      ].map((s) => s.applicantName)
    ),
  ];
  const applicants = await prisma.employee.findMany({
    where: { name: { in: applicantNames } },
    select: { id: true, name: true },
  });
  const applicantByName = new Map(applicants.map((e) => [e.name, e.id]));

  const resolveDelivery = (code: string) => {
    const d = deliveryByCode.get(code);
    if (!d) throw new Error(`seedDevApplications: 納品先 ${code} が見つかりません`);
    return d;
  };
  const resolveApplicant = (name: string) => {
    const id = applicantByName.get(name);
    if (!id) throw new Error(`seedDevApplications: 申請者 ${name} が見つかりません`);
    return id;
  };
  const goalPositionOf = (chain: readonly string[]) => {
    const last = roleByCd.get(chain[chain.length - 1]);
    if (!last) throw new Error(`seedDevApplications: 役割 ${chain[chain.length - 1]} が未登録です`);
    return last.positionId;
  };
  const memberOf = (roleCd: string) => {
    const id = memberByRoleCd.get(roleCd);
    if (!id) throw new Error(`seedDevApplications: 役割 ${roleCd} のメンバーが見つかりません`);
    return new EmployeeId(id);
  };
  const planOf = (chain: readonly string[]): ApprovalChainPlan =>
    ApprovalChainPlan.create(
      new PositionId(goalPositionOf(chain)),
      chain.map((cd) => {
        const r = roleByCd.get(cd);
        if (!r) throw new Error(`seedDevApplications: 役割 ${cd} が未登録です`);
        return new RoleId(r.id);
      })
    );

  const now = Date.now();
  const daysAgo = (n: number): Date => new Date(now - n * DAY_MS);
  const estimateDate = new Date(now);
  const deadline = new Date(now + 30 * DAY_MS);

  /** 申請対象の単一バリエーション見積（NEW・CUSTOMER・1 明細）を作成し永続化する。 */
  const createEstimate = async (opts: {
    number: string;
    customerId: string;
    deliveryLocationId: string;
    createdBy: string;
    amount: number;
    productId?: string;
    itemName?: string;
    inactive?: boolean;
  }) => {
    const estimate = EstimateFactory.create({
      estimateDate,
      deadline,
      customerId: new CustomerId(opts.customerId),
      deliveryLocationId: new DeliveryLocationId(opts.deliveryLocationId),
      taxRate: TAX_RATE,
      taxRoundingType: TAX_ROUNDING,
      createdBy: new EmployeeId(opts.createdBy),
      departmentId: new DepartmentId(fk.departmentId),
      estimateNumber: EstimateNumber.parse(opts.number),
      variations: [
        {
          setGroups: [],
          variationNumber: 1,
          submissionType: SubmissionType.CUSTOMER,
          items: [
            {
              productId: new ProductId(opts.productId ?? fk.individualId),
              sortOrder: 1,
              itemName: new ItemName(opts.itemName ?? "申請対象明細"),
              quantity: new Quantity(1),
              unit: new Unit("個"),
              unitPrice: Money.fromMajorUnits(opts.amount),
              discountRate: new DiscountRate(1.0),
              revisedDeliveryPrice: null,
            },
          ],
        },
      ],
    });
    if (opts.inactive) estimate.deactivateVariation(estimate.variations[0].id);
    await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(estimate) });
    return estimate;
  };

  /** 申請系フィクスチャ（PENDING/APPROVED/REJECTED/WITHDRAWN）を 1 件投入する。 */
  const seedApp = async (spec: AppSpec) => {
    const delivery = resolveDelivery(spec.deliveryCode);
    const applicantId = resolveApplicant(spec.applicantName);
    const estimate = await createEstimate({
      number: spec.number,
      customerId: delivery.customerId,
      deliveryLocationId: delivery.id,
      createdBy: applicantId,
      amount: spec.amount,
      inactive: spec.inactive,
    });

    const application = EstimateApplication.create({
      variationId: estimate.variations[0].id,
      attempt: 1,
      applicantEmployeeId: new EmployeeId(applicantId),
      plan: planOf(spec.chain),
    });

    // 終端イベントの駆動: 状態ごとに承認/差戻/取下をドメイン API で積む（順序ガードに従う）。
    if (spec.kind === "approved") {
      spec.chain.forEach((cd, i) => application.approve(application.steps[i].id, memberOf(cd)));
    } else if (spec.kind === "rejected") {
      const at = spec.rejectAt ?? 0;
      for (let i = 0; i < at; i++)
        application.approve(application.steps[i].id, memberOf(spec.chain[i]));
      application.reject(
        application.steps[at].id,
        memberOf(spec.chain[at]),
        new RejectionComment(spec.comment ?? "差し戻します")
      );
    } else if (spec.kind === "withdrawn") {
      application.withdraw(new EmployeeId(applicantId));
    } else if (spec.approveUpTo) {
      // pending の途中承認
      for (let i = 0; i < spec.approveUpTo; i++)
        application.approve(application.steps[i].id, memberOf(spec.chain[i]));
    }

    await prisma.estimateApplication.create({
      data: {
        ...EstimateApplicationMapper.toCreateInput(application),
        createdAt: daysAgo(spec.daysAgo),
      },
    });
    const approvals = EstimateApplicationMapper.toStepApprovalCreateInputs(application);
    if (approvals.length > 0) await prisma.estimateStepApproval.createMany({ data: approvals });
    const rejections = EstimateApplicationMapper.toStepRejectionCreateInputs(application);
    if (rejections.length > 0) await prisma.estimateStepRejection.createMany({ data: rejections });
    const withdrawal = EstimateApplicationMapper.toWithdrawalCreateInput(application);
    if (withdrawal) await prisma.estimateApplicationWithdrawal.create({ data: withdrawal });
  };

  /** 免除フィクスチャ（EXEMPTED）を 1 件投入する。免除理由に応じて見積構成を変える。 */
  const seedExempt = async (spec: ExemptSpec) => {
    const delivery = resolveDelivery(spec.deliveryCode);
    const exemptorId = resolveApplicant(spec.applicantName);
    let estimate;
    if (spec.reason === "AFTER_REPAIR") {
      // 事後見積（A 接頭辞＋事後修理詳細が必須）。
      estimate = EstimateFactory.create({
        estimateDate,
        deadline,
        customerId: new CustomerId(delivery.customerId),
        deliveryLocationId: new DeliveryLocationId(delivery.id),
        taxRate: TAX_RATE,
        taxRoundingType: TAX_ROUNDING,
        createdBy: new EmployeeId(exemptorId),
        departmentId: new DepartmentId(fk.departmentId),
        estimateNumber: EstimateNumber.parse(spec.number),
        variations: [
          {
            setGroups: [],
            variationNumber: 1,
            submissionType: SubmissionType.CUSTOMER,
            items: [
              {
                productId: new ProductId(fk.repairTargetId),
                sortOrder: 1,
                itemName: new ItemName("事後修理明細"),
                quantity: new Quantity(1),
                unit: new Unit("個"),
                unitPrice: Money.fromMajorUnits(spec.amount),
                discountRate: new DiscountRate(1.0),
                revisedDeliveryPrice: null,
              },
            ],
          },
        ],
        afterRepairDetail: {
          targetProductId: new ProductId(fk.repairTargetId),
          faultDescription: new FaultDescription("定着ユニットの故障により印刷不良"),
          actualRepairDate: new Date(now - (spec.daysAgo + 2) * DAY_MS),
          emergencyReason: new EmergencyReason("業務停止を避けるため即日修理を実施"),
        },
      });
      if (spec.inactive) estimate.deactivateVariation(estimate.variations[0].id);
      await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(estimate) });
    } else {
      // 10万未満（個別商品・少額）／消耗品のみ（消耗品を数量多め）。
      const isConsumable = spec.reason === "CONSUMABLE_ONLY";
      estimate = await createEstimate({
        number: spec.number,
        customerId: delivery.customerId,
        deliveryLocationId: delivery.id,
        createdBy: exemptorId,
        amount: spec.amount,
        productId: isConsumable ? fk.consumableId : fk.individualId,
        itemName: isConsumable ? "消耗品明細" : "免除対象明細",
        inactive: spec.inactive,
      });
    }

    const exemption = EstimateApprovalExemption.create(
      estimate.variations[0].id,
      REASON_VO[spec.reason],
      new EmployeeId(exemptorId)
    );
    await prisma.estimateApprovalExemption.create({
      data: {
        ...EstimateApprovalExemptionMapper.toCreateInput(exemption),
        createdAt: daysAgo(spec.daysAgo),
      },
    });
  };

  for (const spec of [...PENDING_SPECS, ...APPROVED_SPECS, ...REJECTED_SPECS, ...WITHDRAWN_SPECS]) {
    await seedApp(spec);
  }
  for (const spec of EXEMPT_SPECS) {
    await seedExempt(spec);
  }

  // --- リッチケース（詳細画面用・同一バリエーションに attempt1 差戻 → attempt2 途中承認 PENDING）。 ---
  // 差戻→再申請の履歴・差戻コメント・多段途中承認を 1 見積で一度に確認できる。
  const richDelivery = resolveDelivery("D001");
  const richApplicantId = resolveApplicant("営業 課員");
  const richEstimate = await createEstimate({
    number: "N9906160",
    customerId: richDelivery.customerId,
    deliveryLocationId: richDelivery.id,
    createdBy: richApplicantId,
    amount: 2000000,
    itemName: "再申請対象明細",
  });
  const richVariationId = richEstimate.variations[0].id;

  // attempt1: 単段（営業一課長）を差し戻す（過去履歴＝差戻コメントで読む対象）。
  const rejectedApp = EstimateApplication.create({
    variationId: richVariationId,
    attempt: 1,
    applicantEmployeeId: new EmployeeId(richApplicantId),
    plan: planOf(CHAINS.eigyo1Sec),
  });
  rejectedApp.reject(
    rejectedApp.steps[0].id,
    memberOf("ROLE009"),
    new RejectionComment("再申請前に見積根拠を精査してください")
  );
  await prisma.estimateApplication.create({
    data: { ...EstimateApplicationMapper.toCreateInput(rejectedApp), createdAt: daysAgo(12) },
  });
  await prisma.estimateStepRejection.createMany({
    data: EstimateApplicationMapper.toStepRejectionCreateInputs(rejectedApp),
  });

  // attempt2: 2 段（営業一課長→営業部長）。課長のみ承認済＝部長が承認待ちの最新 PENDING。
  const reappliedApp = EstimateApplication.create({
    variationId: richVariationId,
    attempt: 2,
    applicantEmployeeId: new EmployeeId(richApplicantId),
    plan: planOf(CHAINS.eigyo1Dep),
  });
  reappliedApp.approve(reappliedApp.steps[0].id, memberOf("ROLE009"));
  await prisma.estimateApplication.create({
    data: { ...EstimateApplicationMapper.toCreateInput(reappliedApp), createdAt: daysAgo(3) },
  });
  await prisma.estimateStepApproval.createMany({
    data: EstimateApplicationMapper.toStepApprovalCreateInputs(reappliedApp),
  });

  // 投入した見積数（申請系＋免除系＋リッチ 1）。
  return (
    PENDING_SPECS.length +
    APPROVED_SPECS.length +
    REJECTED_SPECS.length +
    WITHDRAWN_SPECS.length +
    EXEMPT_SPECS.length +
    1
  );
}
