import { describe, it, expect } from "vitest";
import type { Money } from "@server/shared/domain/values/Money";
import type { EstimateVariationId } from "../../values/EstimateVariationId";
import { buildVariation } from "../estimateChildBuilders";
import type {
  CopiedItemDescriptor,
  EstimateVariationDescriptor,
  RepricedItemDescriptor,
  RepricedVariationDescriptor,
  RevisedItemDescriptor,
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
/**
 * `T` の optional キーの合併（optional が 1 本も無ければ `never`）。
 * `Pick<T, K>` が `object`（＝全キー省略可の型）を受け入れるなら K は optional、という判定。
 */
type OptionalKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T];

describe("repriced 記述子・通常 buildVariation の型不変則", () => {
  it("引き継ぎ記述子に optional キーが 1 本も存在しない", () => {
    // 構造ガード（#617）: `Required<>` は変換であって不変則ではないため、`&` で後から optional を
    // 足す経路（本設計自身が RevisedItemDescriptor で使う操作）をフィールド個別ガードでは塞げない。
    // 「optional がゼロ本」を型で固定し、将来 optional が紛れ込んだら tsc を赤にする。
    type _NoOptional = [
      OptionalKeys<CopiedItemDescriptor>,
      OptionalKeys<RevisedItemDescriptor>,
    ] extends [never, never]
      ? true
      : never;
    const guard: _NoOptional = true;
    expect(guard).toBe(true);
  });

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

  it("CopiedItemDescriptor は改訂納品価格 revisedDeliveryPrice を型で拒否する", () => {
    const guard = (
      base: CopiedItemDescriptor,
      revisedDeliveryPrice: Money
    ): CopiedItemDescriptor => ({
      ...base,
      // @ts-expect-error 複製先に改訂明細詳細は生えない（revisedDeliveryPrice は Omit 済み・#617）
      revisedDeliveryPrice,
    });
    expect(typeof guard).toBe("function");
  });

  it("RevisedItemDescriptor は改訂納品価格 revisedDeliveryPrice の省略を型で拒否する", () => {
    const guard = (
      base: Omit<RevisedItemDescriptor, "revisedDeliveryPrice">
    ): RevisedItemDescriptor =>
      // @ts-expect-error revisedDeliveryPrice は省略できない（§8.4 の比較基準を落とさない・#617）
      ({ ...base });
    expect(typeof guard).toBe("function");
  });

  it("RepricedVariationDescriptor はセット群 setGroups の省略を型で拒否する", () => {
    const guard = (
      base: Omit<RepricedVariationDescriptor, "setGroups">
    ): RepricedVariationDescriptor =>
      // @ts-expect-error setGroups は省略できない（#602 の火元・#617）
      ({ ...base });
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
