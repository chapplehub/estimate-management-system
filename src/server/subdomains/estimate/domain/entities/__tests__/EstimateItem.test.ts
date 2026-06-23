import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";
import { DiscountRate } from "../../values/DiscountRate";
import { EstimateItemId } from "../../values/EstimateItemId";
import { ItemName } from "../../values/ItemName";
import { Memo } from "../../values/Memo";
import { Money } from "@server/shared/domain/values/Money";
import { Quantity } from "../../values/Quantity";
import { Unit } from "../../values/Unit";
import { EstimateItem, type EstimateItemCreateInput } from "../EstimateItem";
import { RevisedEstimateItemDetail } from "../RevisedEstimateItemDetail";

function buildInput(overrides: Partial<EstimateItemCreateInput> = {}): EstimateItemCreateInput {
  return {
    productId: ProductId.generate(),
    sortOrder: 1,
    itemName: new ItemName("ステンレスポンプ"),
    quantity: new Quantity(2),
    unit: new Unit("台"),
    unitPrice: Money.fromMajorUnits(10000),
    ...overrides,
  };
}

describe("EstimateItem", () => {
  describe("create() - 初期化と自動計算", () => {
    it("最低限の必須項目で作成できる（discountRate=1.0, itemDiscount=0 既定）", () => {
      const item = EstimateItem.create(buildInput());

      expect(item.itemName.value).toBe("ステンレスポンプ");
      expect(item.quantity.value).toBe(2);
      expect(item.unitPrice.equals(Money.fromMajorUnits(10000))).toBe(true);
      expect(item.discountRate.value).toBe(1.0);
      expect(item.itemDiscount.isZero()).toBe(true);
    });

    it("baseAmount = 数量 × 単価（自動算出、§8.1(1)）", () => {
      const item = EstimateItem.create(
        buildInput({ quantity: new Quantity(3), unitPrice: Money.fromMajorUnits(1500) })
      );
      expect(item.baseAmount.equals(Money.fromMajorUnits(4500))).toBe(true);
    });

    it("discountedAmount = baseAmount × discountRate（自動算出、§8.1(2)）", () => {
      const item = EstimateItem.create(
        buildInput({
          quantity: new Quantity(1),
          unitPrice: Money.fromMajorUnits(10000),
          discountRate: new DiscountRate(0.9),
        })
      );
      expect(item.discountedAmount.equals(Money.fromMajorUnits(9000))).toBe(true);
    });

    it("finalAmount = discountedAmount - itemDiscount（自動算出、§8.1(3)）", () => {
      const item = EstimateItem.create(
        buildInput({
          quantity: new Quantity(1),
          unitPrice: Money.fromMajorUnits(10000),
          discountRate: new DiscountRate(0.9),
          itemDiscount: Money.fromMajorUnits(500),
        })
      );
      expect(item.finalAmount.equals(Money.fromMajorUnits(8500))).toBe(true);
    });

    it("値引き後マイナスになる場合はエラー（LineItemAmountPolicy 由来）", () => {
      expect(() =>
        EstimateItem.create(
          buildInput({
            quantity: new Quantity(1),
            unitPrice: Money.fromMajorUnits(1000),
            itemDiscount: Money.fromMajorUnits(2000),
          })
        )
      ).toThrow("値引き後の金額がマイナスになります");
    });

    it("memo は省略可能（空 Memo になる）", () => {
      const item = EstimateItem.create(buildInput());
      expect(item.customerMemo.isEmpty()).toBe(true);
      expect(item.internalMemo.isEmpty()).toBe(true);
    });

    it("revisedDetail は省略可能（null）", () => {
      const item = EstimateItem.create(buildInput());
      expect(item.revisedDetail).toBeNull();
    });

    // 注: 商品名 / 単位 / メモの長さ・必須バリデーションは VO（ItemName / Unit /
    // Memo）のコンストラクタに移譲済み。境界値テストは各 VO の単体テストを参照。
  });

  describe("自動再計算（状態変更で再計算が走る）", () => {
    it("changeQuantity で baseAmount/discountedAmount/finalAmount が再計算される", () => {
      const item = EstimateItem.create(
        buildInput({ quantity: new Quantity(1), unitPrice: Money.fromMajorUnits(1000) })
      );
      expect(item.finalAmount.equals(Money.fromMajorUnits(1000))).toBe(true);

      item.changeQuantity(new Quantity(5));

      expect(item.baseAmount.equals(Money.fromMajorUnits(5000))).toBe(true);
      expect(item.finalAmount.equals(Money.fromMajorUnits(5000))).toBe(true);
    });

    it("changeUnitPrice で再計算される", () => {
      const item = EstimateItem.create(
        buildInput({ quantity: new Quantity(2), unitPrice: Money.fromMajorUnits(1000) })
      );
      item.changeUnitPrice(Money.fromMajorUnits(3000));
      expect(item.baseAmount.equals(Money.fromMajorUnits(6000))).toBe(true);
    });

    it("changeDiscountRate で再計算される", () => {
      const item = EstimateItem.create(
        buildInput({ quantity: new Quantity(1), unitPrice: Money.fromMajorUnits(10000) })
      );
      item.changeDiscountRate(new DiscountRate(0.8));
      expect(item.discountedAmount.equals(Money.fromMajorUnits(8000))).toBe(true);
      expect(item.finalAmount.equals(Money.fromMajorUnits(8000))).toBe(true);
    });

    it("changeItemDiscount で finalAmount が再計算される", () => {
      const item = EstimateItem.create(
        buildInput({ quantity: new Quantity(1), unitPrice: Money.fromMajorUnits(10000) })
      );
      item.changeItemDiscount(Money.fromMajorUnits(1000));
      expect(item.finalAmount.equals(Money.fromMajorUnits(9000))).toBe(true);
    });

    it("自動再計算でも値引き後マイナスはエラー", () => {
      const item = EstimateItem.create(
        buildInput({ quantity: new Quantity(1), unitPrice: Money.fromMajorUnits(1000) })
      );
      expect(() => item.changeItemDiscount(Money.fromMajorUnits(2000))).toThrow(
        "値引き後の金額がマイナス"
      );
    });

    it("changeSortOrder は金額を再計算しない（updatedAt のみ更新）", async () => {
      const item = EstimateItem.create(buildInput());
      const beforeFinal = item.finalAmount;
      const beforeUpdated = item.updatedAt;
      await new Promise((r) => setTimeout(r, 5));

      item.changeSortOrder(99);

      expect(item.finalAmount).toBe(beforeFinal);
      expect(item.updatedAt.getTime()).toBeGreaterThan(beforeUpdated.getTime());
    });
  });

  describe("メタ情報の変更", () => {
    it("changeItemName で名前を変更できる", () => {
      const item = EstimateItem.create(buildInput());
      item.changeItemName(new ItemName("新ポンプ"));
      expect(item.itemName.value).toBe("新ポンプ");
    });

    it("changeCustomerMemo で空 Memo をセットできる（メモ消去）", () => {
      const item = EstimateItem.create(buildInput({ customerMemo: Memo.create("初期メモ") }));
      expect(item.customerMemo.value).toBe("初期メモ");
      item.changeCustomerMemo(Memo.empty());
      expect(item.customerMemo.isEmpty()).toBe(true);
    });
  });

  describe("revisedDetail の attach/detach", () => {
    it("attachRevisedDetail で改訂明細を付加できる", () => {
      const item = EstimateItem.create(buildInput());
      const detail = RevisedEstimateItemDetail.create(Money.fromMajorUnits(8000));
      item.attachRevisedDetail(detail);
      expect(item.revisedDetail).toBe(detail);
    });

    it("detachRevisedDetail で外せる", () => {
      const item = EstimateItem.create(buildInput());
      item.attachRevisedDetail(RevisedEstimateItemDetail.create(Money.fromMajorUnits(8000)));
      item.detachRevisedDetail();
      expect(item.revisedDetail).toBeNull();
    });
  });

  describe("reconstruct() - 永続化値の復元（再計算しない）", () => {
    it("DB から復元した金額はそのまま保持される（マスタ改訂後でも値が変わらない）", () => {
      const productId = ProductId.generate();
      // わざと算出値と異なる「保存済み」金額を渡す → reconstruct は信頼してそのまま使う
      const item = EstimateItem.reconstruct({
        id: EstimateItemId.generate(),
        productId,
        sortOrder: 1,
        itemName: new ItemName("旧名称"),
        quantity: new Quantity(1),
        unit: new Unit("個"),
        unitPrice: Money.fromMajorUnits(10000),
        discountRate: new DiscountRate(1.0),
        itemDiscount: Money.zero(),
        customerMemo: Memo.empty(),
        internalMemo: Memo.empty(),
        revisedDetail: null,
        baseAmount: Money.fromMajorUnits(9999), // 異常値だが信頼
        discountedAmount: Money.fromMajorUnits(9999),
        finalAmount: Money.fromMajorUnits(9999),
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-02"),
      });

      expect(item.baseAmount.equals(Money.fromMajorUnits(9999))).toBe(true);
      expect(item.finalAmount.equals(Money.fromMajorUnits(9999))).toBe(true);
    });
  });
});
