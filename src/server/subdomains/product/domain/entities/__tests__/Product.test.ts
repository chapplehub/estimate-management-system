import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { ComponentQuantity } from "../../values/ComponentQuantity";
import { ProductCategory } from "../../values/ProductCategory";
import { ProductCode } from "../../values/ProductCode";
import { ProductDescription } from "../../values/ProductDescription";
import { ProductId } from "../../values/ProductId";
import { ProductName } from "../../values/ProductName";
import { ProductNote } from "../../values/ProductNote";
import { ProductRelation } from "../../values/ProductRelation";
import { ProductUnit } from "../../values/ProductUnit";
import { SetProductComponent } from "../../values/SetProductComponent";
import { Product } from "../Product";

describe("Product", () => {
  // ========================================
  // create
  // ========================================

  describe("create", () => {
    it("必須項目のみで個別商品を作成できる", () => {
      const product = Product.create(
        new ProductCode("PROD001"),
        new ProductName("テスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      );

      expect(product.code.value).toBe("PROD001");
      expect(product.name.value).toBe("テスト商品");
      expect(product.category.equals(ProductCategory.INDIVIDUAL)).toBe(true);
      expect(product.unit.value).toBe("UNIT");
      expect(product.isActive).toBe(true);
      expect(product.description).toBeNull();
      expect(product.note).toBeNull();
      expect(product.relatedProducts).toEqual([]);
      expect(product.components).toEqual([]);
    });

    it("全項目で個別商品を作成できる", () => {
      const product = Product.create(
        new ProductCode("PROD002"),
        new ProductName("テスト商品2"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.PIECE,
        new ProductDescription("商品説明"),
        new ProductNote("備考")
      );

      expect(product.description?.value).toBe("商品説明");
      expect(product.note?.value).toBe("備考");
    });
  });

  // ========================================
  // reconstruct
  // ========================================

  describe("reconstruct", () => {
    it("DBから再構築できる", () => {
      const id = ProductId.generate();
      const now = new Date();

      const product = Product.reconstruct(
        id,
        new ProductCode("PROD001"),
        new ProductName("テスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT,
        true,
        null,
        null,
        [],
        [],
        now,
        now
      );

      expect(product.id.equals(id)).toBe(true);
      expect(product.code.value).toBe("PROD001");
      expect(product.isActive).toBe(true);
    });
  });

  // ========================================
  // mutation メソッド
  // ========================================

  describe("changeName", () => {
    it("名前を変更できる", () => {
      const product = createIndividualProduct();
      product.changeName(new ProductName("新しい名前"));
      expect(product.name.value).toBe("新しい名前");
    });
  });

  describe("changeCode", () => {
    it("コードを変更できる", () => {
      const product = createIndividualProduct();
      product.changeCode(new ProductCode("NEWCODE01"));
      expect(product.code.value).toBe("NEWCODE01");
    });
  });

  describe("changeUnit", () => {
    it("単位を変更できる", () => {
      const product = createIndividualProduct();
      product.changeUnit(ProductUnit.BOX);
      expect(product.unit.value).toBe("BOX");
    });
  });

  describe("changeDescription", () => {
    it("説明を変更できる", () => {
      const product = createIndividualProduct();
      product.changeDescription(new ProductDescription("新しい説明"));
      expect(product.description?.value).toBe("新しい説明");
    });

    it("説明をnullに変更できる", () => {
      const product = createIndividualProduct();
      product.changeDescription(new ProductDescription("一時的な説明"));
      product.changeDescription(null);
      expect(product.description).toBeNull();
    });
  });

  describe("changeNote", () => {
    it("備考を変更できる", () => {
      const product = createIndividualProduct();
      product.changeNote(new ProductNote("新しい備考"));
      expect(product.note?.value).toBe("新しい備考");
    });
  });

  // ========================================
  // activate / deactivate
  // ========================================

  describe("activate", () => {
    it("無効な商品を有効化できる", () => {
      const product = createInactiveProduct();
      product.activate();
      expect(product.isActive).toBe(true);
    });

    it("すでに有効な商品を有効化するとエラー", () => {
      const product = createIndividualProduct();
      expect(() => product.activate()).toThrow(BusinessRuleViolationError);
      expect(() => product.activate()).toThrow("すでに有効な商品です");
    });
  });

  describe("deactivate", () => {
    it("有効な商品を無効化できる", () => {
      const product = createIndividualProduct();
      product.deactivate();
      expect(product.isActive).toBe(false);
    });

    it("すでに無効な商品を無効化するとエラー", () => {
      const product = createInactiveProduct();
      expect(() => product.deactivate()).toThrow(BusinessRuleViolationError);
      expect(() => product.deactivate()).toThrow("すでに無効な商品です");
    });
  });

  // ========================================
  // setRelatedProducts
  // ========================================

  describe("setRelatedProducts", () => {
    it("個別商品に周辺商品を設定できる", () => {
      const product = createIndividualProduct();
      const relatedId = ProductId.generate();
      const relations = [
        ProductRelation.create(relatedId, ProductCategory.CONSUMABLE, new ComponentQuantity(2)),
      ];

      product.setRelatedProducts(relations);
      expect(product.relatedProducts).toHaveLength(1);
      expect(product.relatedProducts[0].relatedProductId.equals(relatedId)).toBe(true);
    });

    it("消耗品は周辺商品を持てない", () => {
      const product = createConsumableProduct();
      const relations = [
        ProductRelation.create(
          ProductId.generate(),
          ProductCategory.INDIVIDUAL,
          new ComponentQuantity(1)
        ),
      ];

      expect(() => product.setRelatedProducts(relations)).toThrow(BusinessRuleViolationError);
      expect(() => product.setRelatedProducts(relations)).toThrow(
        "個別商品のみ周辺商品を設定できます"
      );
    });

    it("SET商品は周辺商品を持てない", () => {
      const product = createSetProduct();
      const relations = [
        ProductRelation.create(
          ProductId.generate(),
          ProductCategory.INDIVIDUAL,
          new ComponentQuantity(1)
        ),
      ];

      expect(() => product.setRelatedProducts(relations)).toThrow(BusinessRuleViolationError);
    });

    it("自分自身を周辺商品に設定できない", () => {
      const product = createIndividualProduct();
      const relations = [
        ProductRelation.create(product.id, ProductCategory.INDIVIDUAL, new ComponentQuantity(1)),
      ];

      expect(() => product.setRelatedProducts(relations)).toThrow(BusinessRuleViolationError);
      expect(() => product.setRelatedProducts(relations)).toThrow(
        "自分自身を周辺商品に設定することはできません"
      );
    });

    it("重複する周辺商品は設定できない", () => {
      const product = createIndividualProduct();
      const relatedId = ProductId.generate();
      const relations = [
        ProductRelation.create(relatedId, ProductCategory.INDIVIDUAL, new ComponentQuantity(1)),
        ProductRelation.create(relatedId, ProductCategory.INDIVIDUAL, new ComponentQuantity(2)),
      ];

      expect(() => product.setRelatedProducts(relations)).toThrow(BusinessRuleViolationError);
    });

    it("空配列で周辺商品をクリアできる", () => {
      const product = createIndividualProduct();
      const relations = [
        ProductRelation.create(
          ProductId.generate(),
          ProductCategory.CONSUMABLE,
          new ComponentQuantity(1)
        ),
      ];
      product.setRelatedProducts(relations);
      expect(product.relatedProducts).toHaveLength(1);

      product.setRelatedProducts([]);
      expect(product.relatedProducts).toHaveLength(0);
    });
  });

  // ========================================
  // setComponents
  // ========================================

  describe("setComponents", () => {
    it("SET商品に構成商品を設定できる", () => {
      const product = createSetProduct();
      const componentId = ProductId.generate();
      const components = [
        SetProductComponent.create(
          componentId,
          ProductCategory.INDIVIDUAL,
          new ComponentQuantity(3)
        ),
      ];

      product.setComponents(components);
      expect(product.components).toHaveLength(1);
      expect(product.components[0].componentProductId.equals(componentId)).toBe(true);
    });

    it("個別商品は構成商品を持てない", () => {
      const product = createIndividualProduct();
      const components = [
        SetProductComponent.create(
          ProductId.generate(),
          ProductCategory.INDIVIDUAL,
          new ComponentQuantity(1)
        ),
      ];

      expect(() => product.setComponents(components)).toThrow(BusinessRuleViolationError);
      expect(() => product.setComponents(components)).toThrow(
        "セット商品のみ構成商品を設定できます"
      );
    });

    it("重複する構成商品は設定できない", () => {
      const product = createSetProduct();
      const componentId = ProductId.generate();
      const components = [
        SetProductComponent.create(
          componentId,
          ProductCategory.INDIVIDUAL,
          new ComponentQuantity(1)
        ),
        SetProductComponent.create(
          componentId,
          ProductCategory.INDIVIDUAL,
          new ComponentQuantity(2)
        ),
      ];

      expect(() => product.setComponents(components)).toThrow(BusinessRuleViolationError);
    });
  });
});

// ========================================
// ヘルパー関数
// ========================================

function createIndividualProduct(): Product {
  return Product.create(
    new ProductCode("IND001"),
    new ProductName("個別商品"),
    ProductCategory.INDIVIDUAL,
    ProductUnit.UNIT
  );
}

function createConsumableProduct(): Product {
  return Product.create(
    new ProductCode("CON001"),
    new ProductName("消耗品"),
    ProductCategory.CONSUMABLE,
    ProductUnit.PIECE
  );
}

function createSetProduct(): Product {
  return Product.create(
    new ProductCode("SET001"),
    new ProductName("セット商品"),
    ProductCategory.SET,
    ProductUnit.SET
  );
}

function createInactiveProduct(): Product {
  const id = ProductId.generate();
  return Product.reconstruct(
    id,
    new ProductCode("INACTIVE01"),
    new ProductName("無効商品"),
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
