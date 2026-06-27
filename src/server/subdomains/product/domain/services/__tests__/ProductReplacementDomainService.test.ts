import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Product } from "../../entities/Product";
import { ComponentQuantity } from "../../values/ComponentQuantity";
import { ProductCategory } from "../../values/ProductCategory";
import { ProductCode } from "../../values/ProductCode";
import { ProductId } from "../../values/ProductId";
import { ProductName } from "../../values/ProductName";
import { ProductRelation } from "../../values/ProductRelation";
import { ProductUnit } from "../../values/ProductUnit";
import { SetProductComponent } from "../../values/SetProductComponent";
import { ProductReplacementDomainService } from "../ProductReplacementDomainService";

describe("ProductReplacementDomainService", () => {
  const service = new ProductReplacementDomainService();

  // ヘルパー: 有効な個別商品を生成
  function createActiveIndividual(code: string, name: string): Product {
    return Product.create(
      new ProductCode(code),
      new ProductName(name),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
  }

  // ヘルパー: 有効な消耗品を生成
  function createActiveConsumable(code: string, name: string): Product {
    return Product.create(
      new ProductCode(code),
      new ProductName(name),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
  }

  // ヘルパー: 無効な商品を生成
  function createInactiveProduct(code: string, name: string): Product {
    const id = ProductId.generate();
    return Product.reconstruct(
      id,
      new ProductCode(code),
      new ProductName(name),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT,
      false,
      null,
      null,
      [],
      [],
      new Date(),
      new Date()
    );
  }

  // ヘルパー: SET商品を生成
  function createSetProduct(code: string, name: string): Product {
    return Product.create(
      new ProductCode(code),
      new ProductName(name),
      ProductCategory.SET,
      ProductUnit.SET
    );
  }

  // ヘルパー: 周辺商品を持つ個別商品をreconstructで生成
  function createIndividualWithRelations(
    code: string,
    name: string,
    relatedProductIds: ProductId[]
  ): Product {
    const id = ProductId.generate();
    const relations = relatedProductIds.map((rpId) =>
      ProductRelation.reconstruct(rpId, ProductCategory.INDIVIDUAL, new ComponentQuantity(1))
    );
    return Product.reconstruct(
      id,
      new ProductCode(code),
      new ProductName(name),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT,
      true,
      null,
      null,
      relations,
      [],
      new Date(),
      new Date()
    );
  }

  // ヘルパー: 構成商品を持つSET商品をreconstructで生成
  function createSetWithComponents(
    code: string,
    name: string,
    componentProductIds: ProductId[]
  ): Product {
    const id = ProductId.generate();
    const components = componentProductIds.map((cpId) =>
      SetProductComponent.reconstruct(cpId, ProductCategory.INDIVIDUAL, new ComponentQuantity(1))
    );
    return Product.reconstruct(
      id,
      new ProductCode(code),
      new ProductName(name),
      ProductCategory.SET,
      ProductUnit.SET,
      true,
      null,
      null,
      [],
      components,
      new Date(),
      new Date()
    );
  }

  it("有効な個別商品への入れ替えが成功する", () => {
    const targetId = ProductId.generate();
    const replacement = createActiveIndividual("REPL001", "入れ替え先商品");
    const referencingProduct = createIndividualWithRelations("REF001", "参照元商品", [targetId]);

    expect(() =>
      service.validateReplacement(targetId, replacement, [referencingProduct])
    ).not.toThrow();
  });

  it("有効な消耗品への入れ替えが成功する", () => {
    const targetId = ProductId.generate();
    const replacement = createActiveConsumable("REPL002", "入れ替え先消耗品");
    const referencingProduct = createIndividualWithRelations("REF002", "参照元商品", [targetId]);

    expect(() =>
      service.validateReplacement(targetId, replacement, [referencingProduct])
    ).not.toThrow();
  });

  it("参照元が空の場合でも成功する", () => {
    const targetId = ProductId.generate();
    const replacement = createActiveIndividual("REPL003", "入れ替え先商品");

    expect(() => service.validateReplacement(targetId, replacement, [])).not.toThrow();
  });

  it("B013: 無効な商品への入れ替えはエラー", () => {
    const targetId = ProductId.generate();
    const replacement = createInactiveProduct("INACT001", "無効商品");
    const referencingProduct = createIndividualWithRelations("REF003", "参照元商品", [targetId]);

    expect(() => service.validateReplacement(targetId, replacement, [referencingProduct])).toThrow(
      BusinessRuleViolationError
    );
    expect(() => service.validateReplacement(targetId, replacement, [referencingProduct])).toThrow(
      "入れ替え先の商品が無効です: INACT001"
    );
  });

  it("B014: セット商品への入れ替えはエラー", () => {
    const targetId = ProductId.generate();
    const replacement = createSetProduct("SET999", "セット商品");
    const referencingProduct = createIndividualWithRelations("REF004", "参照元商品", [targetId]);

    expect(() => service.validateReplacement(targetId, replacement, [referencingProduct])).toThrow(
      BusinessRuleViolationError
    );
    expect(() => service.validateReplacement(targetId, replacement, [referencingProduct])).toThrow(
      "セット商品は入れ替え先として指定できません: SET999"
    );
  });

  it("B015: 周辺商品で重複する場合はエラー", () => {
    const targetId = ProductId.generate();
    const replacement = createActiveIndividual("REPL004", "入れ替え先商品");

    // 参照元商品が、targetIdとreplacement.idの両方を周辺商品に持つ
    const referencingProduct = createIndividualWithRelations("REF005", "参照元商品A", [
      targetId,
      replacement.id,
    ]);

    expect(() => service.validateReplacement(targetId, replacement, [referencingProduct])).toThrow(
      BusinessRuleViolationError
    );
    expect(() => service.validateReplacement(targetId, replacement, [referencingProduct])).toThrow(
      "参照元商品A (REF005) で重複します。"
    );
  });

  it("B015: セット構成で重複する場合はエラー", () => {
    const targetId = ProductId.generate();
    const replacement = createActiveConsumable("REPL005", "入れ替え先消耗品");

    // セット商品が、targetIdとreplacement.idの両方を構成商品に持つ
    const referencingSet = createSetWithComponents("SET005", "参照元セット商品", [
      targetId,
      replacement.id,
    ]);

    expect(() => service.validateReplacement(targetId, replacement, [referencingSet])).toThrow(
      BusinessRuleViolationError
    );
    expect(() => service.validateReplacement(targetId, replacement, [referencingSet])).toThrow(
      "参照元セット商品 (SET005) で重複します。"
    );
  });

  it("B015: 複数の参照元のうち1つでも重複があればエラー", () => {
    const targetId = ProductId.generate();
    const replacement = createActiveIndividual("REPL006", "入れ替え先商品");

    // 参照元1: 重複なし
    const ref1 = createIndividualWithRelations("REF006A", "参照元商品1", [targetId]);
    // 参照元2: 重複あり
    const ref2 = createIndividualWithRelations("REF006B", "参照元商品2", [
      targetId,
      replacement.id,
    ]);

    expect(() => service.validateReplacement(targetId, replacement, [ref1, ref2])).toThrow(
      BusinessRuleViolationError
    );
    expect(() => service.validateReplacement(targetId, replacement, [ref1, ref2])).toThrow(
      "参照元商品2 (REF006B) で重複します。"
    );
  });
});
