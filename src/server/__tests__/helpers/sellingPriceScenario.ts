import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import {
  CommonSellingPrice,
  CustomerSellingPrice,
  DeliveryLocationSellingPrice,
} from "@subdomains/pricing/domain/entities";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaCommonSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository";
import { PrismaCustomerSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCustomerSellingPriceRepository";
import { PrismaDeliveryLocationSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";

/**
 * 単体テスト用の販売単価シナリオ生成ヘルパー（Issue #430）。
 *
 * seed-unit は正準マスタ（役職・役割・消費税率）のみの方針を維持するため、販売単価マスタ行は
 * 各テストが自前で生成する。#430 以降の見積コマンドテストは「商品選択時に価格決定で見積単価が
 * 確定される」ため、対象商品に有効な販売単価行が存在することを前提にする。本ヘルパーはその
 * 前提を1行で用意する。
 *
 * `addPeriod` の過去不変制約（ADR-20260627-86b）により適用開始日は参照日（今日）以降に限られる。
 * 既定は「今日始まり・無期限」とし、`estimateDate` を今日以降にすれば確実に解決するようにする。
 * 同一対象へ二度与えても後勝ちになるよう、既存集約を消してから挿入する（冪等・並列実行に耐える）。
 */
export type SellingPriceScenario = {
  /** 売単価（円・major units）。 */
  yen: number;
  /** 商品区分。既定は個別（INDIVIDUAL）。セット商品は販売単価を持てない（生成時に拒否される）。 */
  category?: ProductCategory;
  /** 適用開始日（JST 暦日 `"YYYY-MM-DD"`）。既定は今日。参照日より前は past-invariant で拒否される。 */
  start?: string;
  /** 適用終了日（半開区間の上端。null で無期限）。既定は無期限。 */
  end?: string | null;
  /** 参照日（今日・JST 暦日）。テストで過去不変制約の基準を固定したい場合に上書きする。既定は今日。 */
  today?: string;
};

/** 対象商品に共通販売単価を与える（既存の共通販売単価集約は置き換える）。 */
export async function giveCommonSellingPrice(
  productId: string,
  scenario: SellingPriceScenario
): Promise<void> {
  const today = scenario.today ?? todayJst();
  await prisma.commonSellingPrice.deleteMany({ where: { productId } });

  const aggregate = CommonSellingPrice.create(
    new ProductId(productId),
    scenario.category ?? ProductCategory.INDIVIDUAL
  );
  aggregate.addPeriod(periodOf(scenario, today), priceOf(scenario), today);
  await new PrismaCommonSellingPriceRepository().insert(aggregate);
}

/** 対象の得意先×商品に得意先別販売単価を与える（既存集約は置き換える）。 */
export async function giveCustomerSellingPrice(
  customerId: string,
  productId: string,
  scenario: SellingPriceScenario
): Promise<void> {
  const today = scenario.today ?? todayJst();
  await prisma.customerSellingPrice.deleteMany({ where: { customerId, productId } });

  const aggregate = CustomerSellingPrice.create(
    new CustomerId(customerId),
    new ProductId(productId),
    scenario.category ?? ProductCategory.INDIVIDUAL
  );
  aggregate.addPeriod(periodOf(scenario, today), priceOf(scenario), today);
  await new PrismaCustomerSellingPriceRepository().insert(aggregate);
}

/** 対象の納品先×商品に納品先別販売単価を与える（既存集約は置き換える）。 */
export async function giveDeliveryLocationSellingPrice(
  deliveryLocationId: string,
  productId: string,
  scenario: SellingPriceScenario
): Promise<void> {
  const today = scenario.today ?? todayJst();
  await prisma.deliveryLocationSellingPrice.deleteMany({
    where: { deliveryLocationId, productId },
  });

  const aggregate = DeliveryLocationSellingPrice.create(
    new DeliveryLocationId(deliveryLocationId),
    new ProductId(productId),
    scenario.category ?? ProductCategory.INDIVIDUAL
  );
  aggregate.addPeriod(periodOf(scenario, today), priceOf(scenario), today);
  await new PrismaDeliveryLocationSellingPriceRepository().insert(aggregate);
}

/**
 * 対象商品に共通販売単価が無ければ与える（既にあれば何もしない・並列安全）。
 *
 * {@link giveCommonSellingPrice} は delete→insert の「後勝ち」で、複数プロセスが同一商品へ同時に
 * 走ると delete/insert が競合する。全テストファイルで共有するフィクスチャ商品（ensureEstimateFixtures の
 * productId）へ販売単価を用意する用途では、この「不在時のみ挿入・競合は握って存在確認で成功扱い」の
 * 冪等版を使う。値は初回挿入時に固定され、以後の呼び出しでは変えない（全ファイルが同一 yen を渡す前提）。
 */
export async function ensureCommonSellingPrice(
  productId: string,
  scenario: SellingPriceScenario
): Promise<void> {
  if (await prisma.commonSellingPrice.findUnique({ where: { productId } })) {
    return;
  }
  const today = scenario.today ?? todayJst();
  const aggregate = CommonSellingPrice.create(
    new ProductId(productId),
    scenario.category ?? ProductCategory.INDIVIDUAL
  );
  aggregate.addPeriod(periodOf(scenario, today), priceOf(scenario), today);
  try {
    await new PrismaCommonSellingPriceRepository().insert(aggregate);
  } catch (error) {
    // 並列 beforeAll での競合（別プロセスが先に挿入）はここで握る。存在すれば成功扱い。
    if (!(await prisma.commonSellingPrice.findUnique({ where: { productId } }))) {
      throw error;
    }
  }
}

/**
 * 共通販売単価付きの個別商品を用意し、その productId を返す（見積コマンドテスト用）。
 *
 * #430 以降の C1/C3/C4 コマンドテストは対象商品に有効な販売単価が必要になる。共有フィクスチャ商品
 * （ensureEstimateFixtures）へ販売単価を書き込むとファイル並列実行で衝突するため、各テストファイルは
 * 本ヘルパーで自ファイル固有コードの専用商品を用意する。`code` はファイル間で衝突しないようにすること。
 *
 * 商品はコードで冪等に用意する（既存なら再利用）。販売単価は giveCommonSellingPrice で与える。
 */
export async function ensurePricedProduct(params: {
  code: string;
  name?: string;
  yen: number;
  start?: string;
  end?: string | null;
  today?: string;
}): Promise<string> {
  const existing = await prisma.product.findUnique({ where: { code: params.code } });
  const productId =
    existing?.id ??
    (
      await new PrismaProductRepository().insert(
        Product.create(
          new ProductCode(params.code),
          new ProductName(params.name ?? `販売単価テスト商品 ${params.code}`),
          ProductCategory.INDIVIDUAL,
          ProductUnit.UNIT
        )
      )
    ).id.value;

  await giveCommonSellingPrice(productId, {
    yen: params.yen,
    start: params.start,
    end: params.end,
    today: params.today,
  });
  return productId;
}

function periodOf(scenario: SellingPriceScenario, today: string): ApplicablePeriod {
  return ApplicablePeriod.create({ start: scenario.start ?? today, end: scenario.end ?? null });
}

function priceOf(scenario: SellingPriceScenario): SellingUnitPrice {
  return SellingUnitPrice.fromMoney(Money.fromMajorUnits(scenario.yen));
}

function todayJst(): string {
  return toJstCalendarDay(new Date());
}
