import { describe, it, expect } from "vitest";
import type { Money } from "@server/shared/domain/values/Money";
import type { EstimateVariationId } from "../../values/EstimateVariationId";
import { buildVariation } from "../estimateChildBuilders";
import type {
  EstimateVariationDescriptor,
  RepricedItemDescriptor,
  RepricedVariationDescriptor,
} from "../EstimateFactory";
import type { TaxContext } from "../EstimateVariation";

/**
 * 単価再解決経路の型不変則を `@ts-expect-error` で固定する型ガードテスト（#603）。
 *
 * 実行時アサーションではなく `tsc --noEmit`（pre-push）で担保する。各ガードは有効なベース記述子に
 * 禁止フィールドの追加「だけ」を差分にして、その 1 行がコンパイルエラーになることを固定する。
 * 型を緩める変更が入ると `@ts-expect-error` が未使用になり pre-push が赤になる（意図した破壊検知）。
 *
 * ガード本体は実行しない関数に閉じ込める（型検査のみが目的で、実行時に値は要らない）。テストは
 * その関数が存在することだけを確認し、実効性は tsc が保証する。
 */
describe("repriced 記述子・通常 buildVariation の型不変則", () => {
  it("RepricedItemDescriptor は固定値引 itemDiscount を型で拒否する", () => {
    const guard = (base: RepricedItemDescriptor, itemDiscount: Money): RepricedItemDescriptor => ({
      ...base,
      // @ts-expect-error itemDiscount は repriced 記述子で Omit 済み（#603・ADR-20260714-pv8）
      itemDiscount,
    });
    expect(typeof guard).toBe("function");
  });

  it("RepricedVariationDescriptor は全体値引 overallDiscount を型で拒否する", () => {
    const guard = (
      base: RepricedVariationDescriptor,
      overallDiscount: Money
    ): RepricedVariationDescriptor => ({
      ...base,
      // @ts-expect-error overallDiscount は repriced 記述子で Omit 済み（#603・ADR-20260714-pv8）
      overallDiscount,
    });
    expect(typeof guard).toBe("function");
  });

  it("通常 buildVariation は改訂系譜 revisedFrom を受け取らない", () => {
    const guard = (
      descriptor: EstimateVariationDescriptor,
      tax: TaxContext,
      revisedFrom: EstimateVariationId
    ) =>
      // @ts-expect-error 通常 buildVariation は revisedFrom を取らない（改訂は buildRevisedVariation 経由・#603）
      buildVariation(descriptor, tax, revisedFrom);
    expect(typeof guard).toBe("function");
  });
});
