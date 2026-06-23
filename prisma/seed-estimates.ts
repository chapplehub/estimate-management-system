/**
 * 見積のシードデータ（#330 / S2 閲覧画面のデモ・E2E 用）。
 *
 * 方針（計画 Q8 の趣旨）: 金額・集計はドメインで導出させ、raw Prisma での再実装ドリフトを避ける。
 * 構築は EstimateFactory（集約）→ EstimateMapper.toEstimateCreateInput（Prisma 入力）で行い、
 * 書き込みは呼び出し側 seed の PrismaClient（dev=.env / e2e=.env.test）に通す。
 *   ※ 計画は PrismaEstimateRepository.save() を想定していたが、repository は @server/prisma
 *     シングルトン（別 DB）を使うため seed では使えない。EstimateMapper 経由に置き換えた。
 *
 * セット群（ADR-0047）は S5 で追加した（buildSetGroupEstimate）。群ヘッダは toEstimateCreateInput の
 * ネスト create、所属交差表は estimate_items 作成後に別 createMany で書く（Mapper の順序制約）。
 * 改訂は明細の revisedDeliveryPrice スナップショットのみで表現する。
 */
import type { PrismaClient } from "../generated/prisma/client";
import { ProductCategory } from "../generated/prisma/enums";
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
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { FaultDescription } from "@subdomains/estimate/domain/values/FaultDescription";
import { ItemName } from "@subdomains/estimate/domain/values/ItemName";
import { Money } from "@server/shared/domain/values/Money";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { TaxRoundingType } from "@subdomains/estimate/domain/values/TaxRoundingType";
import { Unit } from "@subdomains/estimate/domain/values/Unit";

/** シード見積番号（接頭辞 N/R + 年度 99 + 連番 05xxx）。テスト予約帯（0000x/0100x）と非重複。 */
export const SEED_ESTIMATE_NUMBERS = {
  full: "N9905001",
  allInactive: "N9905002",
  /** S3 ヘッダー編集の E2E 用（締切日・部署・端数の編集対象）。 */
  editable: "N9905003",
  /** S3 修理情報編集の E2E 用（REPAIR）。 */
  repair: "R9905001",
  /** S3 改訂ロック表示の E2E 用（得意先改訂済み＝hasRevision）。 */
  revised: "N9905004",
  /** S5 セット群編集の E2E 用（セット群1＋通常明細1・非改訂 ACTIVE＝編集対象）。 */
  setGroup: "N9905005",
  /** C7 得意先改訂の E2E 用（改訂前・hasRevision=false の起点。納品先宛 V1＝改訂元適格）。 */
  reviseSource: "N9905006",
  /** S7 無効化/有効化（C5）の E2E 用（V1・V2 とも ACTIVE。トグルで状態を往復させる）。 */
  s7Toggle: "N9905007",
} as const;

/** 見積が参照する FK マスタ（呼び出し側 seed の作成済みデータから解決した ID）。 */
type EstimateSeedFk = {
  customerId: string;
  deliveryLocationId: string;
  departmentId: string;
  createdBy: string;
  productAId: string;
  productBId: string;
  /** セット群（ADR-0047）の群ヘッダに使う SET 区分商品。構成は productA/B（個別）を使う。 */
  setProductId: string;
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

/** S3 編集 E2E 用のシンプルな NEW 見積（締切日・部署・端数の編集対象）。 */
function buildEditableEstimate(fk: EstimateSeedFk) {
  return EstimateFactory.create({
    ...header(fk),
    estimateNumber: EstimateNumber.parse(SEED_ESTIMATE_NUMBERS.editable),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [mkItem(fk.productAId, 1, "編集対象明細", 1, 1000)],
      },
    ],
  });
}

/** S3 修理情報編集 E2E 用の REPAIR 見積（事前修理詳細つき）。 */
function buildRepairSeedEstimate(fk: EstimateSeedFk) {
  return EstimateFactory.create({
    ...header(fk),
    estimateNumber: EstimateNumber.parse(SEED_ESTIMATE_NUMBERS.repair),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [mkItem(fk.productAId, 1, "修理見積明細", 1, 5000)],
      },
    ],
    repairDetail: {
      targetProductId: new ProductId(fk.productAId),
      faultDescription: new FaultDescription("起動時に異音がする"),
      scheduledRepairDate: new Date("2026-05-15T00:00:00.000Z"),
    },
  });
}

/**
 * S3 改訂ロック表示 E2E 用の改訂済み見積（hasRevision=true）。
 * 納品先宛 V1 を得意先改訂して V2（revisedFrom=V1）を生成する。系譜行は呼び出し側で別途作る。
 */
function buildRevisedEstimate(fk: EstimateSeedFk) {
  const estimate = EstimateFactory.create({
    ...header(fk),
    estimateNumber: EstimateNumber.parse(SEED_ESTIMATE_NUMBERS.revised),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        items: [mkItem(fk.productAId, 1, "改訂元明細", 1, 4000)],
      },
    ],
  });
  estimate.reviseForCustomer(estimate.variations[0].id);
  return estimate;
}

/**
 * C7 得意先改訂 E2E 用の見積（改訂前・hasRevision=false）。改訂操作の起点。
 * V1 は納品先宛・ACTIVE（改訂元適格＝得意先改訂ボタンが出る）、V2 は得意先宛・ACTIVE
 * （適格外＝ボタンが出ない）。系譜は張らず、改訂操作そのもので改訂先 V3 を生成させ
 * 初回改訂→ヘッダーロック発火の遷移を観測できるようにする。
 */
function buildReviseSourceEstimate(fk: EstimateSeedFk) {
  return EstimateFactory.create({
    ...header(fk),
    estimateNumber: EstimateNumber.parse(SEED_ESTIMATE_NUMBERS.reviseSource),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        items: [mkItem(fk.productAId, 1, "改訂元明細(納品先)", 1, 5000)],
      },
      {
        variationNumber: 2,
        submissionType: SubmissionType.CUSTOMER,
        items: [mkItem(fk.productBId, 1, "得意先明細", 1, 6000)],
      },
    ],
  });
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
 * S7 無効化/有効化（C5）E2E 用の見積。V1・V2 とも ACTIVE で起点とし、トグルで状態を往復させる
 * （無効化→○無効・タブ取消線、全無効→警告、再有効化→●有効）。他ファイルと共有しない専用データ
 * のため serial chain 内で状態を書き換えても干渉しない（ADR-0020・状態変更は独立 chain）。
 */
function buildS7ToggleEstimate(fk: EstimateSeedFk) {
  return EstimateFactory.create({
    ...header(fk),
    estimateNumber: EstimateNumber.parse(SEED_ESTIMATE_NUMBERS.s7Toggle),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [mkItem(fk.productAId, 1, "S7トグル明細1", 1, 1000)],
      },
      {
        variationNumber: 2,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        items: [mkItem(fk.productBId, 1, "S7トグル明細2", 1, 2000)],
      },
    ],
  });
}

/**
 * S5 セット群編集 E2E 用の NEW 見積（ADR-0047）。構成2件のセット群1つ＋通常明細1件。非改訂 ACTIVE。
 * 群ヘッダは SET 商品、構成は個別商品（productA/B）。表示位置・金額は構成から導出される。
 */
function buildSetGroupEstimate(fk: EstimateSeedFk) {
  const setGroup: EstimateSetGroupDescriptor = {
    productId: new ProductId(fk.setProductId),
    itemName: new ItemName("デスクセット一式"),
    unit: new Unit("式"),
    components: [
      mkItem(fk.productAId, 1, "構成: デスク", 1, 3000),
      mkItem(fk.productBId, 2, "構成: チェア", 1, 1500),
    ],
  };
  return EstimateFactory.create({
    ...header(fk),
    estimateNumber: EstimateNumber.parse(SEED_ESTIMATE_NUMBERS.setGroup),
    variations: [
      {
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        items: [mkItem(fk.productAId, 3, "通常明細", 1, 2000)],
        setGroups: [setGroup],
      },
    ],
  });
}

/**
 * 既存の作成済みマスタ（納品先・部署・従業員・個別商品×2・SET 商品×1）を参照して見積を作成する。
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
  // セット群の群ヘッダに使う有効な SET 商品（決定的順序）。
  const setProduct = await prisma.product.findFirst({
    where: { category: ProductCategory.SET, isActive: true },
    orderBy: { code: "asc" },
  });

  if (!deliveryLocation || !department || !employee || products.length < 2 || !setProduct) {
    throw new Error(
      "seedEstimates: 前提マスタ（納品先・部署・従業員・個別商品×2・SET 商品×1）が不足しています"
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
    setProductId: setProduct.id,
  };

  const estimates = [
    buildFullEstimate(fk),
    buildAllInactiveEstimate(fk),
    buildEditableEstimate(fk),
    buildRepairSeedEstimate(fk),
    buildReviseSourceEstimate(fk),
    buildS7ToggleEstimate(fk),
  ];
  for (const estimate of estimates) {
    // 上記はセット群なし → 所属交差表の createMany は不要。
    await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(estimate) });
  }

  // セット群付き見積（S5）: 群ヘッダはネスト create、所属交差表は estimate_items 作成後に別 createMany。
  const setGroupEstimate = buildSetGroupEstimate(fk);
  await prisma.estimate.create({
    data: EstimateMapper.toEstimateCreateInput(setGroupEstimate),
  });
  await prisma.estimateSetComponent.createMany({
    data: EstimateMapper.toSetComponentCreateManyInput(setGroupEstimate),
  });

  // 改訂済み見積（hasRevision）: 見積本体を作成後、改訂系譜行を別途書く
  // （toEstimateCreateInput は系譜を出さない・insert 経路と同じ・ADR-0044）。
  const revised = buildRevisedEstimate(fk);
  await prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(revised) });
  const revisedVariation = revised.variations.find((v) => v.revisedFrom !== null);
  if (revisedVariation) {
    await prisma.estimateVariationRevision.create({
      data: EstimateMapper.toVariationRevisionCreateInput(revisedVariation),
    });
  }

  // estimates（5）＋ セット群付き（1）＋ 改訂済み（1）。
  return estimates.length + 2;
}
