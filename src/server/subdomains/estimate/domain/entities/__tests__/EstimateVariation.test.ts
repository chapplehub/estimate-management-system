import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";
import { ItemName } from "../../values/ItemName";
import { Memo } from "../../values/Memo";
import { Money } from "../../values/Money";
import { Quantity } from "../../values/Quantity";
import { EstimateVariationId } from "../../values/EstimateVariationId";
import { SubmissionType } from "../../values/SubmissionType";
import { TaxRate } from "../../values/TaxRate";
import { Unit } from "../../values/Unit";
import { TaxRoundingType } from "../../values/TaxRoundingType";
import { VariationStatus } from "../../values/VariationStatus";
import { EstimateItem } from "../EstimateItem";
import { EstimateVariation, type TaxContext } from "../EstimateVariation";

const TAX: TaxContext = {
  taxRate: new TaxRate(0.1),
  taxRoundingType: TaxRoundingType.ROUND_DOWN,
};

function makeItem(opts?: {
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  itemDiscount?: number;
}): EstimateItem {
  return EstimateItem.create({
    productId: ProductId.generate(),
    sortOrder: 1,
    itemName: new ItemName(opts?.itemName ?? "テスト商品"),
    quantity: new Quantity(opts?.quantity ?? 1),
    unit: new Unit("個"),
    unitPrice: Money.fromMajorUnits(opts?.unitPrice ?? 1000),
    itemDiscount: Money.fromMajorUnits(opts?.itemDiscount ?? 0),
  });
}

describe("EstimateVariation", () => {
  describe("create() - 初期化と集計の自動算出", () => {
    it("最低限の必須項目で作成できる（items 空、overallDiscount 0 既定）", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
      });

      expect(v.variationNumber).toBe(1);
      expect(v.items).toHaveLength(0);
      expect(v.status).toBe(VariationStatus.ACTIVE);
      expect(v.overallDiscount.isZero()).toBe(true);
    });

    it("明細なしなら全集計が 0 円", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
      });
      expect(v.subtotal.isZero()).toBe(true);
      expect(v.finalTotal.isZero()).toBe(true);
      expect(v.taxAmount.isZero()).toBe(true);
    });

    it("subtotal = Σ(各明細 finalAmount)", () => {
      const items = [
        makeItem({ quantity: 1, unitPrice: 1000 }),
        makeItem({ quantity: 2, unitPrice: 500 }),
      ];
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items,
      });
      // 1000 + 1000 = 2000
      expect(v.subtotal.equals(Money.fromMajorUnits(2000))).toBe(true);
    });

    it("discountSubtotal = Σ(各明細 itemDiscount)", () => {
      const items = [
        makeItem({ unitPrice: 1000, itemDiscount: 100 }),
        makeItem({ unitPrice: 2000, itemDiscount: 300 }),
      ];
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items,
      });
      expect(v.discountSubtotal.equals(Money.fromMajorUnits(400))).toBe(true);
    });

    it("finalSubtotal = subtotal − overallDiscount（§8.1(5)）", () => {
      const items = [makeItem({ unitPrice: 1000 })];
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items,
        overallDiscount: Money.fromMajorUnits(100),
      });
      expect(v.finalSubtotal.equals(Money.fromMajorUnits(900))).toBe(true);
    });

    it("taxAmount は finalSubtotal × 税率（切捨）", () => {
      const items = [makeItem({ unitPrice: 1000 })];
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items,
      });
      // 1000 * 0.1 = 100
      expect(v.taxAmount.equals(Money.fromMajorUnits(100))).toBe(true);
    });

    it("finalTotal = finalSubtotal + taxAmount", () => {
      const items = [makeItem({ unitPrice: 1000 })];
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items,
      });
      expect(v.finalTotal.equals(Money.fromMajorUnits(1100))).toBe(true);
    });

    it("全体値引きが小計を超えるとエラー", () => {
      const items = [makeItem({ unitPrice: 1000 })];
      expect(() =>
        EstimateVariation.create({
          variationNumber: 1,
          submissionType: SubmissionType.CUSTOMER,
          tax: TAX,
          items,
          overallDiscount: Money.fromMajorUnits(2000),
        })
      ).toThrow("値引き後の金額がマイナス");
    });
  });

  describe("バリデーション", () => {
    it("variationNumber が 0 はエラー", () => {
      expect(() =>
        EstimateVariation.create({
          variationNumber: 0,
          submissionType: SubmissionType.CUSTOMER,
          tax: TAX,
        })
      ).toThrow(ValidationError);
    });

    it("variationNumber が 100 はエラー", () => {
      expect(() =>
        EstimateVariation.create({
          variationNumber: 100,
          submissionType: SubmissionType.CUSTOMER,
          tax: TAX,
        })
      ).toThrow("1〜99");
    });

    it("variationNumber が小数はエラー", () => {
      expect(() =>
        EstimateVariation.create({
          variationNumber: 1.5,
          submissionType: SubmissionType.CUSTOMER,
          tax: TAX,
        })
      ).toThrow(ValidationError);
    });

    // 注: メモの長さバリデーションは Memo VO のコンストラクタに移譲済み。
    // 境界値テストは Memo の単体テストを参照。
  });

  describe("addItem / removeItem - 明細追加削除と自動再計算", () => {
    it("addItem で集計が再計算される", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
      });
      expect(v.subtotal.isZero()).toBe(true);

      v.addItem(makeItem({ unitPrice: 5000 }), TAX);

      expect(v.subtotal.equals(Money.fromMajorUnits(5000))).toBe(true);
      expect(v.finalTotal.equals(Money.fromMajorUnits(5500))).toBe(true);
    });

    it("removeItem で集計が再計算される", () => {
      const item = makeItem({ unitPrice: 5000 });
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items: [item],
      });
      expect(v.subtotal.equals(Money.fromMajorUnits(5000))).toBe(true);

      v.removeItem(item.id, TAX);

      expect(v.subtotal.isZero()).toBe(true);
      expect(v.items).toHaveLength(0);
    });

    it("存在しない明細を削除しようとするとエラー", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
      });
      const someItem = makeItem();
      expect(() => v.removeItem(someItem.id, TAX)).toThrow(BusinessRuleViolationError);
    });
  });

  describe("changeItem* - 委譲メソッドと自動再計算", () => {
    it("changeItemQuantity で集計が再計算される", () => {
      const item = makeItem({ quantity: 1, unitPrice: 1000 });
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items: [item],
      });
      expect(v.subtotal.equals(Money.fromMajorUnits(1000))).toBe(true);

      v.changeItemQuantity(item.id, new Quantity(3), TAX);

      expect(v.subtotal.equals(Money.fromMajorUnits(3000))).toBe(true);
      expect(v.finalTotal.equals(Money.fromMajorUnits(3300))).toBe(true);
    });

    it("changeItemUnitPrice で集計が再計算される", () => {
      const item = makeItem({ quantity: 2, unitPrice: 1000 });
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items: [item],
      });

      v.changeItemUnitPrice(item.id, Money.fromMajorUnits(1500), TAX);

      expect(v.subtotal.equals(Money.fromMajorUnits(3000))).toBe(true);
    });

    it("存在しない明細を変更しようとするとエラー", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
      });
      const otherItem = makeItem();
      expect(() => v.changeItemQuantity(otherItem.id, new Quantity(5), TAX)).toThrow(
        BusinessRuleViolationError
      );
    });
  });

  describe("changeOverallDiscount", () => {
    it("全体値引を変更すると集計が再計算される", () => {
      const item = makeItem({ unitPrice: 1000 });
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items: [item],
      });

      v.changeOverallDiscount(Money.fromMajorUnits(200), TAX);

      expect(v.finalSubtotal.equals(Money.fromMajorUnits(800))).toBe(true);
      expect(v.taxAmount.equals(Money.fromMajorUnits(80))).toBe(true);
      expect(v.finalTotal.equals(Money.fromMajorUnits(880))).toBe(true);
    });
  });

  describe("recalculateForTaxChange - 税率変更時の再計算", () => {
    it("税率だけ変えると tax/finalTotal のみ変わる", () => {
      const item = makeItem({ unitPrice: 1000 });
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items: [item],
      });

      const newTax: TaxContext = {
        taxRate: new TaxRate(0.08),
        taxRoundingType: TaxRoundingType.ROUND_DOWN,
      };
      v.recalculateForTaxChange(newTax);

      expect(v.subtotal.equals(Money.fromMajorUnits(1000))).toBe(true);
      expect(v.taxAmount.equals(Money.fromMajorUnits(80))).toBe(true);
      expect(v.finalTotal.equals(Money.fromMajorUnits(1080))).toBe(true);
    });
  });

  describe("状態遷移", () => {
    it("activate / deactivate で status が変わる", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
      });
      expect(v.isActive()).toBe(true);

      v.deactivate();
      expect(v.isActive()).toBe(false);
      expect(v.status).toBe(VariationStatus.INACTIVE);

      v.activate();
      expect(v.isActive()).toBe(true);
    });
  });

  describe("replaceContent - 内容一括差替えと§3.4ガード", () => {
    it("既存明細を別の明細セットに全置換し、集計が新セットで再計算される", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items: [makeItem({ quantity: 1, unitPrice: 1000 })],
      });
      expect(v.subtotal.equals(Money.fromMajorUnits(1000))).toBe(true);

      v.replaceContent(
        {
          items: [
            makeItem({ quantity: 2, unitPrice: 500 }),
            makeItem({ quantity: 1, unitPrice: 3000 }),
          ],
        },
        TAX
      );

      // 500×2 + 3000 = 4000、税10% で finalTotal 4400
      expect(v.items).toHaveLength(2);
      expect(v.subtotal.equals(Money.fromMajorUnits(4000))).toBe(true);
      expect(v.finalTotal.equals(Money.fromMajorUnits(4400))).toBe(true);
    });

    it("無効状態のバリエーションは replaceContent できない（§3.4）", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
      });
      v.deactivate();

      expect(() => v.replaceContent({ items: [makeItem()] }, TAX)).toThrow(
        BusinessRuleViolationError
      );
    });

    it("overallDiscount とメモを更新し、全体値引が finalSubtotal に反映される", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
      });

      v.replaceContent(
        {
          items: [makeItem({ quantity: 1, unitPrice: 10000 })],
          overallDiscount: Money.fromMajorUnits(1000),
          customerMemo: Memo.create("客先メモ"),
        },
        TAX
      );

      // 10000 - 1000(全体値引) = 9000
      expect(v.overallDiscount.equals(Money.fromMajorUnits(1000))).toBe(true);
      expect(v.finalSubtotal.equals(Money.fromMajorUnits(9000))).toBe(true);
      expect(v.customerMemo.value).toBe("客先メモ");
    });

    it("空配列で全置換すると全集計が 0 に戻る", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        items: [makeItem({ unitPrice: 5000 })],
      });

      v.replaceContent({ items: [] }, TAX);

      expect(v.items).toHaveLength(0);
      expect(v.subtotal.isZero()).toBe(true);
      expect(v.finalTotal.isZero()).toBe(true);
    });
  });

  describe("改訂出自（revisedFrom）の保持", () => {
    it("改訂で生まれたバリエーションは改訂元の出自を保持する", () => {
      const sourceId = EstimateVariationId.generate();
      const v = EstimateVariation.create({
        variationNumber: 2,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        revisedFrom: sourceId,
      });

      expect(v.revisedFrom?.equals(sourceId)).toBe(true);
    });

    it("通常作成のバリエーションは出自を持たない（revisedFrom = null）", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        tax: TAX,
      });

      expect(v.revisedFrom).toBeNull();
    });
  });

  describe("行構成固定（改訂先は明細の追加・削除不可）", () => {
    function makeRevisedVariation(items?: EstimateItem[]): EstimateVariation {
      return EstimateVariation.create({
        variationNumber: 2,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        revisedFrom: EstimateVariationId.generate(),
        items: items ?? [makeItem()],
      });
    }

    it("改訂で生まれたバリエーションには明細を追加できない", () => {
      const v = makeRevisedVariation();

      expect(() => v.addItem(makeItem({ itemName: "追加商品" }), TAX)).toThrow(
        BusinessRuleViolationError
      );
      expect(v.items).toHaveLength(1);
    });

    it("改訂で生まれたバリエーションの明細は削除できない", () => {
      const item = makeItem();
      const v = makeRevisedVariation([item]);

      expect(() => v.removeItem(item.id, TAX)).toThrow(BusinessRuleViolationError);
      expect(v.items).toHaveLength(1);
    });

    it("改訂で生まれたバリエーションは内容の一括差替え（C4）ができない", () => {
      const v = makeRevisedVariation();

      expect(() => v.replaceContent({ items: [makeItem()] }, TAX)).toThrow(
        BusinessRuleViolationError
      );
    });

    it("改訂で生まれたバリエーションでも単価・数量・値引・メモの調整はできる", () => {
      const item = makeItem({ unitPrice: 1200 });
      const v = makeRevisedVariation([item]);

      v.changeItemUnitPrice(item.id, Money.fromMajorUnits(1000), TAX);
      v.changeItemQuantity(item.id, new Quantity(3), TAX);
      v.changeOverallDiscount(Money.fromMajorUnits(100), TAX);
      v.changeCustomerMemo(Memo.create("得意先向けに調整"));

      expect(item.unitPrice.equals(Money.fromMajorUnits(1000))).toBe(true);
      expect(v.subtotal.equals(Money.fromMajorUnits(3000))).toBe(true);
      expect(v.customerMemo.value).toBe("得意先向けに調整");
    });
  });

  describe("getters の防御", () => {
    it("items は ReadonlyArray<Readonly<EstimateItem>> 型で外部変更が型レベルで禁止される", () => {
      const v = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
      });
      const items = v.items;

      // ランタイムでは push は呼べてしまうが（JS の制約）、型レベルでは禁止される。
      // @ts-expect-error: ReadonlyArray<T> に push() は存在しない（型エラー）
      items.push(makeItem());

      // 注: @ts-expect-error が将来不要になった（push が型上呼べる状態に
      // 退化した）場合、TS2578 で CI が落ちる仕組み。
      expect(items.length).toBeGreaterThanOrEqual(0);
    });
  });
});
