/**
 * 開発 seed 専用の「未申請の見積（ドラフト）」フィクスチャ（#591）。
 *
 * 用語注記: イシューの「見積もりドラフト」は正準語彙では「バリエーション申請状態が未申請の見積」を
 * 指す口語。ここで作るのは申請前の見積そのもの（EstimateApplication は持たない）。申請すると
 * どの承認段階・どの免除理由になるかは金額と申請者で決まり、その対応表は README に記す。
 *
 * 収録データ:
 *  - 基本7件: 免除3理由（10万未満/消耗品のみ/事後）＋承認段階4段（課長/部長/本部長/社長）を跨ぐ代表。
 *  - 閾値境界ペア: 4閾値（10万/100万/1000万/3000万・税込）それぞれの「直下」と「越え最小」。
 *  - 構造多様性: 全部入り（複数バリ・値引・改訂価格・無効バリ）／セット群／改訂済み／REPAIR。
 *
 * 機構は共有 seed 踏襲: EstimateFactory（集約）→ EstimateMapper.toEstimateCreateInput（Prisma 入力）。
 * dev 専用のため FK は dev の決定的コード（PRD/顧客コード・固定課員名）へ結合する（e2e とは非共有）。
 *
 * 見積番号帯: N9906xxx / R9906xxx / A9906xxx（連番 06xxx）。e2e 予約帯（05xxx）・テスト帯（0000x/0100x）と非重複。
 */
import type { PrismaClient } from "../../generated/prisma/client";
import {
  EstimateFactory,
  type EstimateItemDescriptor,
  type EstimateSetGroupDescriptor,
  type EstimateVariationDescriptor,
} from "@subdomains/estimate/domain/entities/EstimateFactory";
import { EstimateMapper } from "@subdomains/estimate/infrastructure/mappers/EstimateMapper";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
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

/** dev 専用ドラフトの見積番号帯（#591）。README にカタログを記す。 */
export const DEV_ESTIMATE_NUMBERS = {
  // --- 基本7件: 免除3理由＋承認段階4段（税込） ---
  exemptBelowThreshold: "N9906001", // 免除: 税込10万未満（BELOW_THRESHOLD）
  exemptConsumableOnly: "N9906002", // 免除: 消耗品のみ（CONSUMABLE_ONLY・金額無関係）
  exemptAfterRepair: "A9906001", // 免除: 事後見積（AFTER_REPAIR・A接頭辞）
  goalSection: "N9906003", // 承認: 課長ゴール（税込10万〜100万）
  goalDepartment: "N9906004", // 承認: 部長ゴール（税込100万〜1000万）
  goalDivision: "N9906005", // 承認: 本部長ゴール（税込1000万〜3000万）
  goalPresident: "N9906006", // 承認: 社長ゴール（税込3000万〜）
  // --- 閾値境界ペア（税込・直下/越え最小） ---
  edge10manBelow: "N9906010", // 税込99,999 → 免除
  edge10manOver: "N9906011", // 税込100,001 → 課長
  edge100manBelow: "N9906012", // 税込999,999 → 課長
  edge100manOver: "N9906013", // 税込1,000,000 → 部長
  edge1000manBelow: "N9906014", // 税込9,999,999 → 部長
  edge1000manOver: "N9906015", // 税込10,000,001 → 本部長
  edge3000manBelow: "N9906016", // 税込29,999,999 → 本部長
  edge3000manOver: "N9906017", // 税込30,000,000 → 社長
  // --- 構造多様性 ---
  structFull: "N9906020", // 全部入り（複数バリ・明細値引・全体値引・改訂価格・無効バリ）
  structSetGroup: "N9906021", // セット群＋通常明細
  structRevised: "N9906022", // 改訂済み（得意先改訂で hasRevision）
  structRepair: "R9906001", // 修理見積（事前・R接頭辞）
} as const;

const TAX_RATE = new TaxRate(0.1);
const TAX_ROUNDING = TaxRoundingType.ROUND_DOWN;
const DAY_MS = 24 * 60 * 60 * 1000;

/** ドラフトが参照する FK（呼び出し側 seed の作成済みデータから解決）。 */
type DraftFk = {
  customerId: string;
  deliveryLocationId: string;
  departmentId: string;
  createdBy: string;
  /** 個別商品（通常明細用）2 種。 */
  individualAId: string;
  individualBId: string;
  /** 消耗品（消耗品のみ免除用）。 */
  consumableId: string;
  /** SET 商品（セット群の群ヘッダ用）。構成は individualA/B。 */
  setProductId: string;
  /** 修理/事後修理の対象商品。 */
  repairTargetId: string;
};

function mkItem(
  productId: string,
  sortOrder: number,
  itemName: string,
  quantity: number,
  unitPrice: number,
  opts: { itemDiscount?: number; revisedDeliveryPrice?: number } = {}
): EstimateItemDescriptor {
  return {
    productId: new ProductId(productId),
    sortOrder,
    itemName: new ItemName(itemName),
    quantity: new Quantity(quantity),
    unit: new Unit("個"),
    unitPrice: Money.fromMajorUnits(unitPrice),
    discountRate: new DiscountRate(1.0),
    itemDiscount: opts.itemDiscount != null ? Money.fromMajorUnits(opts.itemDiscount) : undefined,
    revisedDeliveryPrice:
      opts.revisedDeliveryPrice != null ? Money.fromMajorUnits(opts.revisedDeliveryPrice) : null,
  };
}

function header(fk: DraftFk, estimateDate: Date, deadline: Date) {
  return {
    estimateDate,
    deadline,
    customerId: new CustomerId(fk.customerId),
    deliveryLocationId: new DeliveryLocationId(fk.deliveryLocationId),
    taxRate: TAX_RATE,
    taxRoundingType: TAX_ROUNDING,
    createdBy: new EmployeeId(fk.createdBy),
    departmentId: new DepartmentId(fk.departmentId),
  };
}

/**
 * 単一バリエーション・単一明細のドラフトを組む共通ビルダー。amount は税抜単価（数量1）。
 * 承認段階・境界ドラフトはこれで金額だけ変えて作る。
 */
function buildSingleLine(
  fk: DraftFk,
  base: { estimateDate: Date; deadline: Date },
  estimateNumber: string,
  itemName: string,
  amount: number,
  productId = fk.individualAId
) {
  return EstimateFactory.create({
    ...header(fk, base.estimateDate, base.deadline),
    estimateNumber: EstimateNumber.parse(estimateNumber),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [mkItem(productId, 1, itemName, 1, amount)],
      },
    ],
  });
}

export async function seedDevEstimates(prisma: PrismaClient): Promise<number> {
  // 参照する商品コードを 1 回の findMany でまとめて解決する。
  const productCodes = ["PRD002", "PRD013", "PRD029", "PRD041", "PRD014"];
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
    if (!id) throw new Error(`seedDevEstimates: 商品 ${code} が見つかりません`);
    return id;
  };
  const deliveryLocation = await prisma.deliveryLocation.findFirst({ where: { code: "D001" } });
  const department = await prisma.department.findFirst({ where: { departmentCd: "DEPT001" } });
  // 作成者は固定課員（営業 課員）へ寄せる（#591・計画）。
  const creator = await prisma.employee.findFirst({ where: { name: "営業 課員" } });

  if (!deliveryLocation || !department || !creator) {
    throw new Error(
      "seedDevEstimates: 前提マスタ（納品先 D001・部署 DEPT001・固定課員『営業 課員』）が不足しています"
    );
  }

  const fk: DraftFk = {
    customerId: deliveryLocation.customerId,
    deliveryLocationId: deliveryLocation.id,
    departmentId: department.id,
    createdBy: creator.id,
    individualAId: findProduct("PRD002"), // オフィスチェア
    individualBId: findProduct("PRD013"), // 27インチモニター
    consumableId: findProduct("PRD029"), // コピー用紙A4（消耗品）
    setProductId: findProduct("PRD041"), // デスクセット一式（SET）
    repairTargetId: findProduct("PRD014"), // A3複合機（修理対象）
  };

  // 締切日を未来に保つため today 相対（再シードで常に有効期限内・ADR-20260629-3x5 と同じ思想）。
  const now = Date.now();
  const base = { estimateDate: new Date(now), deadline: new Date(now + 30 * DAY_MS) };

  // 単純な単一明細ドラフト（免除2理由＋承認段階4段＋境界8件）をまとめて構築する。
  const N = DEV_ESTIMATE_NUMBERS;
  const singleLineDrafts: {
    number: string;
    itemName: string;
    amount: number;
    productId?: string;
  }[] = [
    // 基本: 免除（税込10万未満）＋承認段階4段
    { number: N.exemptBelowThreshold, itemName: "免除対象（税込10万未満）", amount: 50000 }, // 税込55,000
    { number: N.goalSection, itemName: "課長ゴール見積", amount: 300000 }, // 税込330,000
    { number: N.goalDepartment, itemName: "部長ゴール見積", amount: 2000000 }, // 税込2,200,000
    { number: N.goalDivision, itemName: "本部長ゴール見積", amount: 15000000 }, // 税込16,500,000
    { number: N.goalPresident, itemName: "社長ゴール見積", amount: 32000000 }, // 税込35,200,000
    // 境界ペア（税込は subtotal + floor(subtotal*0.1)）
    { number: N.edge10manBelow, itemName: "10万閾値 直下（税込99,999）", amount: 90909 },
    { number: N.edge10manOver, itemName: "10万閾値 越え（税込100,001）", amount: 90910 },
    { number: N.edge100manBelow, itemName: "100万閾値 直下（税込999,999）", amount: 909090 },
    { number: N.edge100manOver, itemName: "100万閾値 ちょうど（税込1,000,000）", amount: 909091 },
    { number: N.edge1000manBelow, itemName: "1000万閾値 直下（税込9,999,999）", amount: 9090909 },
    { number: N.edge1000manOver, itemName: "1000万閾値 越え（税込10,000,001）", amount: 9090910 },
    { number: N.edge3000manBelow, itemName: "3000万閾値 直下（税込29,999,999）", amount: 27272727 },
    {
      number: N.edge3000manOver,
      itemName: "3000万閾値 ちょうど（税込30,000,000）",
      amount: 27272728,
    },
  ];

  for (const d of singleLineDrafts) {
    const estimate = buildSingleLine(fk, base, d.number, d.itemName, d.amount, d.productId);
    await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(estimate) });
  }

  // 免除: 消耗品のみ（金額が10万を超えても消耗品なら免除・ADR-0004 の確認台）。
  const consumableOnly = EstimateFactory.create({
    ...header(fk, base.estimateDate, base.deadline),
    estimateNumber: EstimateNumber.parse(N.exemptConsumableOnly),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [
          mkItem(fk.consumableId, 1, "コピー用紙A4（消耗品）", 40, 5000), // 税込220,000 でも消耗品のみ→免除
        ],
      },
    ],
  });
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(consumableOnly) });

  // 免除: 事後見積（AFTER_REPAIR・金額に依らず免除。A 接頭辞＋事後修理詳細が必須）。
  const afterRepair = EstimateFactory.create({
    ...header(fk, base.estimateDate, base.deadline),
    estimateNumber: EstimateNumber.parse(N.exemptAfterRepair),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [mkItem(fk.repairTargetId, 1, "事後修理明細", 1, 300000)], // 税込330,000 でも事後→免除
      },
    ],
    afterRepairDetail: {
      targetProductId: new ProductId(fk.repairTargetId),
      faultDescription: new FaultDescription("定着ユニットの故障により印刷不良"),
      actualRepairDate: new Date(now - 3 * DAY_MS),
      emergencyReason: new EmergencyReason("繁忙期で業務停止を避けるため即日修理を実施"),
    },
  });
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(afterRepair) });

  // 構造: 全部入り（複数バリ・明細値引・全体値引・改訂価格・無効バリ）。
  const fullVariations: EstimateVariationDescriptor[] = [
    {
      variationNumber: 1,
      submissionType: SubmissionType.CUSTOMER,
      overallDiscount: Money.fromMajorUnits(5000),
      items: [
        mkItem(fk.individualAId, 1, "商品A", 2, 45000),
        mkItem(fk.individualAId, 2, "商品B（明細値引）", 1, 30000, { itemDiscount: 3000 }),
        mkItem(fk.individualBId, 3, "商品C（改訂価格）", 1, 58000, { revisedDeliveryPrice: 52000 }),
      ],
    },
    {
      variationNumber: 2,
      submissionType: SubmissionType.DELIVERY_LOCATION,
      items: [mkItem(fk.individualBId, 1, "納品先向け明細", 3, 20000)],
    },
    {
      variationNumber: 3,
      submissionType: SubmissionType.CUSTOMER,
      items: [mkItem(fk.individualAId, 1, "旧バリエーション（無効化予定）", 1, 10000)],
    },
  ];
  const full = EstimateFactory.create({
    ...header(fk, base.estimateDate, base.deadline),
    estimateNumber: EstimateNumber.parse(N.structFull),
    variations: fullVariations,
  });
  full.deactivateVariation(full.variations[2].id); // V3 を無効化（タブ取消線・全無効警告の手前）
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(full) });

  // 構造: セット群（ADR-0047）＋通常明細。群ヘッダは SET 商品、構成は個別商品。
  const setGroup: EstimateSetGroupDescriptor = {
    productId: new ProductId(fk.setProductId),
    itemName: new ItemName("デスクセット一式"),
    unit: new Unit("式"),
    components: [
      mkItem(fk.individualAId, 1, "構成: デスク", 1, 30000),
      mkItem(fk.individualBId, 2, "構成: チェア", 1, 15000),
    ],
  };
  const setGroupEstimate = EstimateFactory.create({
    ...header(fk, base.estimateDate, base.deadline),
    estimateNumber: EstimateNumber.parse(N.structSetGroup),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [mkItem(fk.individualAId, 3, "通常明細", 1, 20000)],
        setGroups: [setGroup],
      },
    ],
  });
  await prisma.estimate.create({
    data: EstimateMapper.toEstimateCreateInput(setGroupEstimate),
  });
  await prisma.estimateSetComponent.createMany({
    data: EstimateMapper.toSetComponentCreateManyInput(setGroupEstimate),
  });

  // 構造: 改訂済み（納品先宛 V1 を得意先改訂して V2 を生成＝hasRevision）。系譜行は別途書く。
  const revised = EstimateFactory.create({
    ...header(fk, base.estimateDate, base.deadline),
    estimateNumber: EstimateNumber.parse(N.structRevised),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        items: [mkItem(fk.individualAId, 1, "改訂元明細（納品先）", 1, 40000)],
      },
    ],
  });
  // #431: 改訂元単価を引き継ぐ解決済み単価マップ（商品ID → Money）を渡す（dev seed の表示用）。
  const revisionSource = revised.variations[0];
  revised.reviseForCustomer(
    revisionSource.id,
    new Map(revisionSource.items.map((item) => [item.productId.value, item.unitPrice]))
  );
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(revised) });
  const revisedVariation = revised.variations.find((v) => v.revisedFrom !== null);
  if (revisedVariation) {
    await prisma.estimateVariationRevision.create({
      data: EstimateMapper.toVariationRevisionCreateInput(revisedVariation),
    });
  }

  // 構造: 修理見積（事前・REPAIR・R 接頭辞＋修理詳細）。
  const repair = EstimateFactory.create({
    ...header(fk, base.estimateDate, base.deadline),
    estimateNumber: EstimateNumber.parse(N.structRepair),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [mkItem(fk.repairTargetId, 1, "修理見積明細", 1, 80000)],
      },
    ],
    repairDetail: {
      targetProductId: new ProductId(fk.repairTargetId),
      faultDescription: new FaultDescription("給紙ローラーの摩耗により紙詰まりが頻発"),
      scheduledRepairDate: new Date(now + 14 * DAY_MS),
    },
  });
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(repair) });

  return Object.keys(DEV_ESTIMATE_NUMBERS).length;
}
