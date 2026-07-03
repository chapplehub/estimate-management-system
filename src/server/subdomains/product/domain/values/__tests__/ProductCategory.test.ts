import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { ProductCategory } from "../ProductCategory";

describe("ProductCategory", () => {
  // ========================================
  // 生成
  // ========================================

  it("INDIVIDUALを生成できる", () => {
    expect(ProductCategory.INDIVIDUAL.value).toBe("INDIVIDUAL");
  });

  it("CONSUMABLEを生成できる", () => {
    expect(ProductCategory.CONSUMABLE.value).toBe("CONSUMABLE");
  });

  it("SETを生成できる", () => {
    expect(ProductCategory.SET.value).toBe("SET");
  });

  it("from()で文字列から生成できる", () => {
    expect(ProductCategory.from("INDIVIDUAL").equals(ProductCategory.INDIVIDUAL)).toBe(true);
    expect(ProductCategory.from("CONSUMABLE").equals(ProductCategory.CONSUMABLE)).toBe(true);
    expect(ProductCategory.from("SET").equals(ProductCategory.SET)).toBe(true);
  });

  it("不正な値はエラーになる", () => {
    expect(() => ProductCategory.from("INVALID")).toThrow(ValidationError);
  });

  // ========================================
  // canHaveRelatedProducts: 周辺商品を持てるか
  // ========================================

  it("INDIVIDUALは周辺商品を持てる", () => {
    expect(ProductCategory.INDIVIDUAL.canHaveRelatedProducts()).toBe(true);
  });

  it("CONSUMABLEは周辺商品を持てない", () => {
    expect(ProductCategory.CONSUMABLE.canHaveRelatedProducts()).toBe(false);
  });

  it("SETは周辺商品を持てない", () => {
    expect(ProductCategory.SET.canHaveRelatedProducts()).toBe(false);
  });

  // ========================================
  // canHaveComponents: 構成商品を持てるか
  // ========================================

  it("SETは構成商品を持てる", () => {
    expect(ProductCategory.SET.canHaveComponents()).toBe(true);
  });

  it("INDIVIDUALは構成商品を持てない", () => {
    expect(ProductCategory.INDIVIDUAL.canHaveComponents()).toBe(false);
  });

  it("CONSUMABLEは構成商品を持てない", () => {
    expect(ProductCategory.CONSUMABLE.canHaveComponents()).toBe(false);
  });

  // ========================================
  // canBeRelatedProduct: 周辺商品になれるか
  // ========================================

  it("INDIVIDUALは周辺商品になれる", () => {
    expect(ProductCategory.INDIVIDUAL.canBeRelatedProduct()).toBe(true);
  });

  it("CONSUMABLEは周辺商品になれる", () => {
    expect(ProductCategory.CONSUMABLE.canBeRelatedProduct()).toBe(true);
  });

  it("SETは周辺商品になれない", () => {
    expect(ProductCategory.SET.canBeRelatedProduct()).toBe(false);
  });

  // ========================================
  // canBeComponent: 構成商品になれるか
  // ========================================

  it("INDIVIDUALは構成商品になれる", () => {
    expect(ProductCategory.INDIVIDUAL.canBeComponent()).toBe(true);
  });

  it("CONSUMABLEは構成商品になれる", () => {
    expect(ProductCategory.CONSUMABLE.canBeComponent()).toBe(true);
  });

  it("SETは構成商品になれない", () => {
    expect(ProductCategory.SET.canBeComponent()).toBe(false);
  });

  // ========================================
  // canHavePrice: 価格（単価・原価）を持ちうるか＝価格保守対象商品か
  // ========================================

  it("INDIVIDUALは価格を持ちうる", () => {
    expect(ProductCategory.INDIVIDUAL.canHavePrice()).toBe(true);
  });

  it("CONSUMABLEは価格を持ちうる", () => {
    expect(ProductCategory.CONSUMABLE.canHavePrice()).toBe(true);
  });

  it("SETは価格を持たない", () => {
    expect(ProductCategory.SET.canHavePrice()).toBe(false);
  });

  // ========================================
  // priceableValues: 価格保守対象商品の区分値リスト
  // ========================================

  it("価格保守対象商品の区分値は個別商品・消耗品", () => {
    expect(ProductCategory.priceableValues()).toEqual(["INDIVIDUAL", "CONSUMABLE"]);
  // isSet: セット商品か（価格集約の生成ガードで使用・#515）
  // ========================================

  it("SETはセット商品である", () => {
    expect(ProductCategory.SET.isSet()).toBe(true);
  });

  it("INDIVIDUALはセット商品ではない", () => {
    expect(ProductCategory.INDIVIDUAL.isSet()).toBe(false);
  });

  it("CONSUMABLEはセット商品ではない", () => {
    expect(ProductCategory.CONSUMABLE.isSet()).toBe(false);
  });
});
