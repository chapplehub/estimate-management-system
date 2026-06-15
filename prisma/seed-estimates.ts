/**
 * 見積のシードデータ（#330 / S2 閲覧画面のデモ・E2E 用）。
 *
 * 方針（計画 Q8 の趣旨）: 金額・集計はドメインで導出させ、raw Prisma での再実装ドリフトを避ける。
 * 構築は EstimateFactory（集約）→ EstimateMapper.toEstimateCreateInput（Prisma 入力）で行い、
 * 書き込みは呼び出し側 seed の PrismaClient（dev=.env / e2e=.env.test）に通す。
 *   ※ 計画は PrismaEstimateRepository.save() を想定していたが、repository は @server/prisma
 *     シングルトン（別 DB）を使うため seed では使えない。EstimateMapper 経由に置き換えた。
 *
 * セット群は S5（セット編集スライス）へ先送り（本スライスではドメインに群生成の公開経路が
 * 無いため・deviations.md 参照）。改訂は明細の revisedDeliveryPrice スナップショットのみで表現する。
 */
import type { PrismaClient } from "../generated/prisma/client";
import { ProductCategory } from "../generated/prisma/enums";
import {
  EstimateFactory,
  type EstimateItemDescriptor,
  type EstimateVariationDescriptor,
} from "@subdomains/estimate/domain/entities/EstimateFactory";
import { EstimateMapper } from "@subdomains/estimate/infrastructure/mappers/EstimateMapper";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { DiscountRate } from "@subdomains/estimate/domain/values/DiscountRate";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { ItemName } from "@subdomains/estimate/domain/values/ItemName";
import { Money } from "@subdomains/estimate/domain/values/Money";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { TaxRoundingType } from "@subdomains/estimate/domain/values/TaxRoundingType";
import { Unit } from "@subdomains/estimate/domain/values/Unit";

/** シード見積番号（接頭辞 N + 年度 99 + 連番 05xxx）。テスト予約帯（0000x/0100x）と非重複。 */
export const SEED_ESTIMATE_NUMBERS = {
  full: "N9905001",
  allInactive: "N9905002",
} as const;

/** 見積が参照する FK マスタ（呼び出し側 seed の作成済みデータから解決した ID）。 */
type EstimateSeedFk = {
  customerId: string;
  deliveryLocationId: string;
  departmentId: string;
  createdBy: string;
  productAId: string;
  productBId: string;
};

const TAX_RATE = new TaxRate(0.1);
const TAX_ROUNDING = TaxRoundingType.ROUND_DOWN;
const ESTIMATE_DATE = new Date("2026-04-01T00:00:00.000Z");
const DEADLINE = new Date("2026-04-30T00:00:00.000Z");

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

function header(fk: EstimateSeedFk) {
  return {
    estimateDate: ESTIMATE_DATE,
    deadline: DEADLINE,
    customerId: new CustomerId(fk.customerId),
    deliveryLocationId: new DeliveryLocationId(fk.deliveryLocationId),
    taxRate: TAX_RATE,
    taxRoundingType: TAX_ROUNDING,
    createdBy: new EmployeeId(fk.createdBy),
    departmentId: new DepartmentId(fk.departmentId),
  };
}

/**
 * デモ全部入り見積（セット群を除く）: 複数バリ・提出区分両方・改訂価格（薄字）・明細値引・
 * 全体値引・INACTIVE バリ。既定タブ＝最小番号 ACTIVE（V1）。
 */
function buildFullEstimate(fk: EstimateSeedFk) {
  const variations: EstimateVariationDescriptor[] = [
    {
      variationNumber: 1,
      submissionType: SubmissionType.CUSTOMER,
      overallDiscount: Money.fromMajorUnits(1000),
      items: [
        mkItem(fk.productAId, 1, "商品A", 2, 10000),
        mkItem(fk.productAId, 2, "商品B（明細値引）", 1, 5000, { itemDiscount: 500 }),
        mkItem(fk.productBId, 3, "商品C（改訂価格）", 1, 8000, { revisedDeliveryPrice: 7000 }),
      ],
    },
    {
      variationNumber: 2,
      submissionType: SubmissionType.DELIVERY_LOCATION,
      items: [mkItem(fk.productBId, 1, "納品先向け明細", 3, 3000)],
    },
    {
      variationNumber: 3,
      submissionType: SubmissionType.CUSTOMER,
      items: [mkItem(fk.productAId, 1, "旧バリエーション", 1, 1000)],
    },
  ];

  const estimate = EstimateFactory.create({
    ...header(fk),
    estimateNumber: EstimateNumber.parse(SEED_ESTIMATE_NUMBERS.full),
    variations,
  });
  // V3 を無効化（タブのグレーアウト＋取消線の確認用）。
  estimate.deactivateVariation(estimate.variations[2].id);
  return estimate;
}

/** 全バリエーション無効の見積（全無効警告の確認用）。 */
function buildAllInactiveEstimate(fk: EstimateSeedFk) {
  const estimate = EstimateFactory.create({
    ...header(fk),
    estimateNumber: EstimateNumber.parse(SEED_ESTIMATE_NUMBERS.allInactive),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [mkItem(fk.productAId, 1, "無効明細1", 1, 1000)],
      },
      {
        variationNumber: 2,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        items: [mkItem(fk.productBId, 1, "無効明細2", 1, 2000)],
      },
    ],
  });
  for (const v of estimate.variations) {
    estimate.deactivateVariation(v.id);
  }
  return estimate;
}

/**
 * 既存の作成済みマスタ（納品先・部署・従業員・個別商品×2）を参照して見積を作成する。
 * FK は findFirst の決定的順序で解決し、特定コードへ結合しない（dev/e2e 双方で再利用するため）。
 */
export async function seedEstimates(prisma: PrismaClient): Promise<number> {
  const deliveryLocation = await prisma.deliveryLocation.findFirst({ orderBy: { code: "asc" } });
  const department = await prisma.department.findFirst({ orderBy: { departmentCd: "asc" } });
  const employee = await prisma.employee.findFirst({ orderBy: { employeeCd: "asc" } });
  const products = await prisma.product.findMany({
    where: { category: ProductCategory.INDIVIDUAL },
    orderBy: { code: "asc" },
    take: 2,
  });

  if (!deliveryLocation || !department || !employee || products.length < 2) {
    throw new Error(
      "seedEstimates: 前提マスタ（納品先・部署・従業員・個別商品×2）が不足しています"
    );
  }

  const fk: EstimateSeedFk = {
    // 納品先の customerId を使い、見積の得意先と納品先の整合を保証する。
    customerId: deliveryLocation.customerId,
    deliveryLocationId: deliveryLocation.id,
    departmentId: department.id,
    createdBy: employee.id,
    productAId: products[0].id,
    productBId: products[1].id,
  };

  const estimates = [buildFullEstimate(fk), buildAllInactiveEstimate(fk)];
  for (const estimate of estimates) {
    // セット群なし → 所属交差表の createMany は不要。改訂系譜も作らない（明細スナップショットのみ）。
    await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(estimate) });
  }
  return estimates.length;
}
