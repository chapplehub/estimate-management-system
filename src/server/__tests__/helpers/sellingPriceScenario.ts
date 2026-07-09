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
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

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

function periodOf(scenario: SellingPriceScenario, today: string): ApplicablePeriod {
  return ApplicablePeriod.create({ start: scenario.start ?? today, end: scenario.end ?? null });
}

function priceOf(scenario: SellingPriceScenario): SellingUnitPrice {
  return SellingUnitPrice.fromMoney(Money.fromMajorUnits(scenario.yen));
}

function todayJst(): string {
  return toJstCalendarDay(new Date());
}
