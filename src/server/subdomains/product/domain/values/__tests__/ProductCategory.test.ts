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
});
