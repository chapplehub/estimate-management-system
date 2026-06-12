import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";
import { EmergencyReason } from "../../values/EmergencyReason";
import { EstimateNumber } from "../../values/EstimateNumber";
import { EstimateVariationId } from "../../values/EstimateVariationId";
import { FaultDescription } from "../../values/FaultDescription";
import { ItemName } from "../../values/ItemName";
import { Money } from "../../values/Money";
import { Quantity } from "../../values/Quantity";
import { SubmissionType } from "../../values/SubmissionType";
import { Unit } from "../../values/Unit";
import { TaxRate } from "../../values/TaxRate";
import { TaxRoundingType } from "../../values/TaxRoundingType";
import { AfterRepairEstimateDetail } from "../AfterRepairEstimateDetail";
import { Estimate } from "../Estimate";
import { EstimateItem } from "../EstimateItem";
import { EstimateVariation, type TaxContext } from "../EstimateVariation";
import { RepairEstimateDetail } from "../RepairEstimateDetail";

const TAX: TaxContext = {
  taxRate: new TaxRate(0.1),
  taxRoundingType: TaxRoundingType.ROUND_DOWN,
};

function makeItem(unitPrice = 1000, quantity = 1): EstimateItem {
  return EstimateItem.create({
    productId: ProductId.generate(),
    sortOrder: 1,
    itemName: new ItemName("テスト商品"),
    quantity: new Quantity(quantity),
    unit: new Unit("個"),
    unitPrice: Money.fromMajorUnits(unitPrice),
  });
}

function makeVariation(variationNumber = 1, items?: EstimateItem[]): EstimateVariation {
  return EstimateVariation.create({
    variationNumber,
    submissionType: SubmissionType.CUSTOMER,
    tax: TAX,
    items: items ?? [makeItem()],
  });
}

function commonHeader() {
  return {
    estimateDate: new Date("2025-04-01"),
    deadline: new Date("2025-04-30"),
    customerId: CustomerId.generate(),
    deliveryLocationId: DeliveryLocationId.generate(),
    taxRate: TAX.taxRate,
    taxRoundingType: TAX.taxRoundingType,
    createdBy: EmployeeId.generate(),
    departmentId: DepartmentId.generate(),
  };
}

describe("Estimate", () => {
  describe("create() - 不変条件チェック", () => {
    it("最低 1 バリエーションで作成できる（NEW）", () => {
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [makeVariation()],
      });
      expect(e.estimateType.value).toBe("NEW");
      expect(e.variations).toHaveLength(1);
    });

    it("バリエーション 0 つだとエラー（§C1 空見積不可）", () => {
      expect(() =>
        Estimate.create({
          ...commonHeader(),
          estimateNumber: EstimateNumber.parse("N2500001"),
          variations: [],
        })
      ).toThrow("最低 1");
    });

    it("variationNumber 重複はエラー", () => {
      expect(() =>
        Estimate.create({
          ...commonHeader(),
          estimateNumber: EstimateNumber.parse("N2500001"),
          variations: [makeVariation(1), makeVariation(1)],
        })
      ).toThrow(ValidationError);
    });

    describe("ADR-0019 サブタイプ整合", () => {
      it("NEW に repairDetail を渡すとエラー", () => {
        expect(() =>
          Estimate.create({
            ...commonHeader(),
            estimateNumber: EstimateNumber.parse("N2500001"),
            variations: [makeVariation()],
            repairDetail: RepairEstimateDetail.create({
              targetProductId: ProductId.generate(),
              faultDescription: new FaultDescription("故障"),
              scheduledRepairDate: new Date(),
            }),
          })
        ).toThrow("estimateType=NEW");
      });

      it("REPAIR で repairDetail が未指定だとエラー", () => {
        expect(() =>
          Estimate.create({
            ...commonHeader(),
            estimateNumber: EstimateNumber.parse("R2500001"),
            variations: [makeVariation()],
          })
        ).toThrow("estimateType=REPAIR の見積は事前修理見積詳細が必須");
      });

      it("REPAIR で正しい詳細を渡すと成功", () => {
        const e = Estimate.create({
          ...commonHeader(),
          estimateNumber: EstimateNumber.parse("R2500001"),
          variations: [makeVariation()],
          repairDetail: RepairEstimateDetail.create({
            targetProductId: ProductId.generate(),
            faultDescription: new FaultDescription("故障"),
            scheduledRepairDate: new Date(),
          }),
        });
        expect(e.repairDetail).not.toBeNull();
        expect(e.afterRepairDetail).toBeNull();
      });

      it("AFTER_REPAIR で afterRepairDetail が未指定だとエラー", () => {
        expect(() =>
          Estimate.create({
            ...commonHeader(),
            estimateNumber: EstimateNumber.parse("A2500001"),
            variations: [makeVariation()],
          })
        ).toThrow("estimateType=AFTER_REPAIR の見積は事後修理見積詳細が必須");
      });

      it("AFTER_REPAIR で正しい詳細を渡すと成功", () => {
        const e = Estimate.create({
          ...commonHeader(),
          estimateNumber: EstimateNumber.parse("A2500001"),
          variations: [makeVariation()],
          afterRepairDetail: AfterRepairEstimateDetail.create({
            targetProductId: ProductId.generate(),
            faultDescription: new FaultDescription("故障"),
            actualRepairDate: new Date(),
            emergencyReason: new EmergencyReason("緊急"),
          }),
        });
        expect(e.afterRepairDetail).not.toBeNull();
        expect(e.repairDetail).toBeNull();
      });

      it("REPAIR に afterRepairDetail を同時に付けるとエラー", () => {
        expect(() =>
          Estimate.create({
            ...commonHeader(),
            estimateNumber: EstimateNumber.parse("R2500001"),
            variations: [makeVariation()],
            repairDetail: RepairEstimateDetail.create({
              targetProductId: ProductId.generate(),
              faultDescription: new FaultDescription("故障"),
              scheduledRepairDate: new Date(),
            }),
            afterRepairDetail: AfterRepairEstimateDetail.create({
              targetProductId: ProductId.generate(),
              faultDescription: new FaultDescription("故障"),
              actualRepairDate: new Date(),
              emergencyReason: new EmergencyReason("緊急"),
            }),
          })
        ).toThrow("事後修理見積詳細を持てません");
      });
    });
  });

  describe("派生ゲッター（EstimateNumber 経由）", () => {
    it("estimateType は estimateNumber から派生", () => {
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("R2500042"),
        variations: [makeVariation()],
        repairDetail: RepairEstimateDetail.create({
          targetProductId: ProductId.generate(),
          faultDescription: new FaultDescription("故障"),
          scheduledRepairDate: new Date(),
        }),
      });
      expect(e.estimateType.value).toBe("REPAIR");
      expect(e.fiscalYear.value).toBe(2025);
      expect(e.sequence).toBe(42);
    });
  });

  describe("バリエーション操作", () => {
    function makeEstimate() {
      return Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [makeVariation(1)],
      });
    }

    it("addVariation で追加できる", () => {
      const e = makeEstimate();
      e.addVariation(makeVariation(2));
      expect(e.variations).toHaveLength(2);
    });

    it("addVariation で番号重複はエラー", () => {
      const e = makeEstimate();
      expect(() => e.addVariation(makeVariation(1))).toThrow("重複");
    });

    it("removeVariation で削除できる", () => {
      const e = makeEstimate();
      const v2 = makeVariation(2);
      e.addVariation(v2);
      e.removeVariation(v2.id);
      expect(e.variations).toHaveLength(1);
    });

    it("最後の 1 つは削除できない（§C1）", () => {
      const e = makeEstimate();
      const onlyId = e.variations[0].id;
      expect(() => e.removeVariation(onlyId)).toThrow("最後のバリエーション");
    });

    it("activate/deactivate", () => {
      const e = makeEstimate();
      const id = e.variations[0].id;
      e.deactivateVariation(id);
      expect(e.variations[0].isActive()).toBe(false);
      e.activateVariation(id);
      expect(e.variations[0].isActive()).toBe(true);
    });
  });

  describe("明細操作（集約境界 → ルート経由のみ）", () => {
    function makeEstimateWithEmptyV() {
      return Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [
          EstimateVariation.create({
            variationNumber: 1,
            submissionType: SubmissionType.CUSTOMER,
            tax: TAX,
            items: [],
          }),
        ],
      });
    }

    it("addItem で variation の集計が再計算される", () => {
      const e = makeEstimateWithEmptyV();
      const vId = e.variations[0].id;
      expect(e.variations[0].finalTotal.isZero()).toBe(true);

      e.addItem(vId, makeItem(1000));

      expect(e.variations[0].subtotal.equals(Money.fromMajorUnits(1000))).toBe(true);
      expect(e.variations[0].finalTotal.equals(Money.fromMajorUnits(1100))).toBe(true);
    });

    it("changeItemQuantity で集計が再計算される（ルート → variation 委譲）", () => {
      const item = makeItem(1000, 1);
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [
          EstimateVariation.create({
            variationNumber: 1,
            submissionType: SubmissionType.CUSTOMER,
            tax: TAX,
            items: [item],
          }),
        ],
      });
      const vId = e.variations[0].id;

      e.changeItemQuantity(vId, item.id, new Quantity(3));

      expect(e.variations[0].subtotal.equals(Money.fromMajorUnits(3000))).toBe(true);
    });

    it("存在しない variationId はエラー", () => {
      const e = makeEstimateWithEmptyV();
      const fakeVid = EstimateVariation.create({
        variationNumber: 99,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
      }).id;
      expect(() => e.addItem(fakeVid, makeItem())).toThrow("バリエーションは存在しません");
    });
  });

  describe("税情報変更 → 全 variation に伝播", () => {
    it("changeTaxRate で全 variation の taxAmount が再計算される", () => {
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [
          EstimateVariation.create({
            variationNumber: 1,
            submissionType: SubmissionType.CUSTOMER,
            tax: TAX,
            items: [makeItem(1000)],
          }),
          EstimateVariation.create({
            variationNumber: 2,
            submissionType: SubmissionType.CUSTOMER,
            tax: TAX,
            items: [makeItem(2000)],
          }),
        ],
      });
      // 初期: 税率 10% → taxAmount 各 100 / 200
      expect(e.variations[0].taxAmount.equals(Money.fromMajorUnits(100))).toBe(true);
      expect(e.variations[1].taxAmount.equals(Money.fromMajorUnits(200))).toBe(true);

      e.changeTaxRate(new TaxRate(0.05));

      // 5%: 各 50 / 100
      expect(e.variations[0].taxAmount.equals(Money.fromMajorUnits(50))).toBe(true);
      expect(e.variations[1].taxAmount.equals(Money.fromMajorUnits(100))).toBe(true);
    });
  });

  describe("サブタイプ詳細の付け替え", () => {
    it("NEW に attachRepairDetail はエラー", () => {
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [makeVariation()],
      });
      expect(() =>
        e.attachRepairDetail(
          RepairEstimateDetail.create({
            targetProductId: ProductId.generate(),
            faultDescription: new FaultDescription("故障"),
            scheduledRepairDate: new Date(),
          })
        )
      ).toThrow("estimateType=REPAIR の見積にしか");
    });

    it("REPAIR では detachRepairDetail できない", () => {
      const e = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("R2500001"),
        variations: [makeVariation()],
        repairDetail: RepairEstimateDetail.create({
          targetProductId: ProductId.generate(),
          faultDescription: new FaultDescription("故障"),
          scheduledRepairDate: new Date(),
        }),
      });
      expect(() => e.detachRepairDetail()).toThrow("外せません");
    });
  });

  describe("appendVariation - 連番採番付き追加（C3 / §A.2）", () => {
    function makeEstimate(variations: EstimateVariation[]): Estimate {
      return Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations,
      });
    }

    it("max+1 で採番した新バリエーションを追加して返す", () => {
      const e = makeEstimate([makeVariation(1)]);

      const added = e.appendVariation({ items: [makeItem(2000, 1)] }, SubmissionType.CUSTOMER);

      expect(added.variationNumber).toBe(2);
      expect(e.variations).toHaveLength(2);
      expect(added.subtotal.equals(Money.fromMajorUnits(2000))).toBe(true);
    });

    it("歯抜けがあっても max+1 で採番する（count+1 ではない）", () => {
      const e = makeEstimate([makeVariation(1), makeVariation(3)]);

      const added = e.appendVariation({ items: [makeItem()] }, SubmissionType.CUSTOMER);

      // 既存 [1,3] → count+1=3 だと衝突。max+1=4 が正
      expect(added.variationNumber).toBe(4);
    });

    it("内容（明細・全体値引）を反映して追加する", () => {
      const e = makeEstimate([makeVariation(1)]);

      const added = e.appendVariation(
        {
          items: [makeItem(10000, 1)],
          overallDiscount: Money.fromMajorUnits(1000),
        },
        SubmissionType.CUSTOMER
      );

      expect(added.finalSubtotal.equals(Money.fromMajorUnits(9000))).toBe(true);
    });

    it("指定した提出区分が新バリエーションに保持される（ADR-0045）", () => {
      const e = makeEstimate([makeVariation(1)]);

      const added = e.appendVariation({ items: [makeItem()] }, SubmissionType.DELIVERY_LOCATION);

      expect(added.submissionType.isDeliveryLocation()).toBe(true);
    });
  });

  describe("updateVariation - 内容一括差替え（C4）", () => {
    function makeEstimate(variations: EstimateVariation[]): Estimate {
      return Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations,
      });
    }

    it("対象バリエーションの内容を全置換し再計算する", () => {
      const target = makeVariation(1, [makeItem(1000, 1)]);
      const e = makeEstimate([target]);

      e.updateVariation(target.id, { items: [makeItem(500, 2), makeItem(3000, 1)] });

      const updated = e.variations.find((v) => v.id.equals(target.id))!;
      expect(updated.items).toHaveLength(2);
      expect(updated.subtotal.equals(Money.fromMajorUnits(4000))).toBe(true);
    });

    it("存在しないバリエーションIDはエラー", () => {
      const e = makeEstimate([makeVariation(1)]);
      const other = makeVariation(2);

      expect(() => e.updateVariation(other.id, { items: [makeItem()] })).toThrow(
        "指定されたバリエーションは存在しません"
      );
    });
  });

  describe("reviseForCustomer() - 得意先改訂（C7・§7.2）", () => {
    /** 納品先宛バリエーション1つ（明細2件・全体値引あり）の見積を組み立てる。 */
    function buildDeliveryEstimate() {
      const itemA = EstimateItem.create({
        productId: ProductId.generate(),
        sortOrder: 1,
        itemName: new ItemName("商品A"),
        quantity: new Quantity(2),
        unit: new Unit("個"),
        unitPrice: Money.fromMajorUnits(500000),
        itemDiscount: Money.fromMajorUnits(10000),
      });
      const itemB = EstimateItem.create({
        productId: ProductId.generate(),
        sortOrder: 2,
        itemName: new ItemName("商品B"),
        quantity: new Quantity(1),
        unit: new Unit("式"),
        unitPrice: Money.fromMajorUnits(200000),
      });
      const source = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        tax: TAX,
        items: [itemA, itemB],
        overallDiscount: Money.fromMajorUnits(5000),
      });
      const estimate = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [source],
      });
      return { estimate, source, itemA, itemB };
    }

    it("納品先宛バリエーションから得意先宛の新バリエーションを生成する（全複写・調整の出発点）", () => {
      const { estimate, source, itemA, itemB } = buildDeliveryEstimate();

      const revised = estimate.reviseForCustomer(source.id);

      // 得意先宛・出自=改訂元・max+1採番・ACTIVE
      expect(revised.submissionType).toBe(SubmissionType.CUSTOMER);
      expect(revised.revisedFrom?.equals(source.id)).toBe(true);
      expect(revised.variationNumber).toBe(2);
      expect(revised.isActive()).toBe(true);
      expect(estimate.variations).toHaveLength(2);

      // 明細は全複写（C6 と異なり単価・値引もクリアしない）
      expect(revised.items).toHaveLength(2);
      const [revisedA, revisedB] = revised.items;
      expect(revisedA!.itemName.value).toBe("商品A");
      expect(revisedA!.unitPrice.equals(itemA.unitPrice)).toBe(true);
      expect(revisedA!.quantity.value).toBe(2);
      expect(revisedA!.itemDiscount.equals(itemA.itemDiscount)).toBe(true);
      expect(revisedB!.unitPrice.equals(itemB.unitPrice)).toBe(true);
      expect(revised.overallDiscount.equals(source.overallDiscount)).toBe(true);

      // deliveryPrice スナップショット = 改訂元明細の finalAmount（§8.4）
      expect(revisedA!.revisedDetail?.deliveryPrice.equals(itemA.finalAmount)).toBe(true);
      expect(revisedB!.revisedDetail?.deliveryPrice.equals(itemB.finalAmount)).toBe(true);
    });

    it("得意先宛バリエーションは改訂元にできない", () => {
      const { estimate, source } = buildDeliveryEstimate();
      const revised = estimate.reviseForCustomer(source.id);

      expect(() => estimate.reviseForCustomer(revised.id)).toThrow(BusinessRuleViolationError);
    });

    it("無効（INACTIVE）のバリエーションは改訂元にできない", () => {
      const { estimate, source } = buildDeliveryEstimate();
      estimate.deactivateVariation(source.id);

      expect(() => estimate.reviseForCustomer(source.id)).toThrow(BusinessRuleViolationError);
    });

    it("存在しないバリエーションを改訂元に指定するとエラー", () => {
      const { estimate } = buildDeliveryEstimate();

      expect(() => estimate.reviseForCustomer(EstimateVariationId.generate())).toThrow(
        BusinessRuleViolationError
      );
    });

    it("同じ改訂元から再改訂できる（1ソース→複数の得意先宛派生）", () => {
      const { estimate, source } = buildDeliveryEstimate();

      const first = estimate.reviseForCustomer(source.id);
      const second = estimate.reviseForCustomer(source.id);

      expect(first.variationNumber).toBe(2);
      expect(second.variationNumber).toBe(3);
      expect(second.revisedFrom?.equals(source.id)).toBe(true);
      expect(estimate.variations).toHaveLength(3);
    });

    it("改訂すると改訂元は凍結され、以降編集不可になる", () => {
      const { estimate, source } = buildDeliveryEstimate();

      estimate.reviseForCustomer(source.id);

      expect(() => estimate.updateVariation(source.id, { items: [makeItem()] })).toThrow(
        BusinessRuleViolationError
      );
    });
  });

  describe("改訂が存在する見積のヘッダ変更ガード（§7.2 / §8.7）", () => {
    function buildRevisedEstimateViaRevise() {
      const source = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        tax: TAX,
        items: [makeItem(1200)],
      });
      const estimate = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [source],
      });
      estimate.reviseForCustomer(source.id);
      return estimate;
    }

    it("改訂が存在すると見積年月日・税率・税端数区分・得意先・納品先を変更できない", () => {
      const e = buildRevisedEstimateViaRevise();

      expect(() => e.changeEstimateDate(new Date("2025-05-01"))).toThrow(
        BusinessRuleViolationError
      );
      expect(() => e.changeTaxRate(new TaxRate(0.08))).toThrow(BusinessRuleViolationError);
      expect(() => e.changeTaxRoundingType(TaxRoundingType.ROUND_UP)).toThrow(
        BusinessRuleViolationError
      );
      expect(() => e.changeCustomer(CustomerId.generate())).toThrow(BusinessRuleViolationError);
      expect(() => e.changeDeliveryLocation(DeliveryLocationId.generate())).toThrow(
        BusinessRuleViolationError
      );
    });

    it("改訂が存在しても締切日・部署は変更できる", () => {
      const e = buildRevisedEstimateViaRevise();
      const newDeadline = new Date("2025-06-30");
      const newDepartment = DepartmentId.generate();

      e.changeDeadline(newDeadline);
      e.changeDepartment(newDepartment);

      expect(e.deadline).toEqual(newDeadline);
      expect(e.departmentId.equals(newDepartment)).toBe(true);
    });
  });

  describe("凍結 - 改訂元バリエーションの編集ガード（ADR-0044）", () => {
    /**
     * 改訂済みの見積を組み立てる:
     * V1 = 納品先宛（改訂元・凍結）、V2 = 得意先宛（改訂先・revisedFrom=V1）
     */
    function buildRevisedEstimate() {
      const sourceItem = makeItem(1200);
      const source = EstimateVariation.create({
        variationNumber: 1,
        submissionType: SubmissionType.DELIVERY_LOCATION,
        tax: TAX,
        items: [sourceItem],
      });
      const revisedItem = makeItem(1200);
      const revised = EstimateVariation.create({
        variationNumber: 2,
        submissionType: SubmissionType.CUSTOMER,
        tax: TAX,
        revisedFrom: source.id,
        items: [revisedItem],
      });
      const estimate = Estimate.create({
        ...commonHeader(),
        estimateNumber: EstimateNumber.parse("N2500001"),
        variations: [source, revised],
      });
      return { estimate, source, revised, sourceItem, revisedItem };
    }

    it("改訂元（凍結）は内容の一括差替え（C4）ができない", () => {
      const { estimate, source } = buildRevisedEstimate();

      expect(() => estimate.updateVariation(source.id, { items: [makeItem()] })).toThrow(
        BusinessRuleViolationError
      );
    });

    it("改訂元（凍結）には明細操作（追加・単価変更・全体値引変更）ができない", () => {
      const { estimate, source, sourceItem } = buildRevisedEstimate();

      expect(() => estimate.addItem(source.id, makeItem())).toThrow(BusinessRuleViolationError);
      expect(() =>
        estimate.changeItemUnitPrice(source.id, sourceItem.id, Money.fromMajorUnits(900))
      ).toThrow(BusinessRuleViolationError);
      expect(() => estimate.changeOverallDiscount(source.id, Money.fromMajorUnits(100))).toThrow(
        BusinessRuleViolationError
      );
    });

    it("改訂元（凍結）は削除できない（系譜が存在する間）", () => {
      const { estimate, source } = buildRevisedEstimate();

      expect(() => estimate.removeVariation(source.id)).toThrow(BusinessRuleViolationError);
      expect(estimate.variations).toHaveLength(2);
    });

    it("改訂元（凍結）でもステータス変更（無効化・有効化）はできる（直交概念）", () => {
      const { estimate, source } = buildRevisedEstimate();

      estimate.deactivateVariation(source.id);
      expect(estimate.variations[0]!.isActive()).toBe(false);

      estimate.activateVariation(source.id);
      expect(estimate.variations[0]!.isActive()).toBe(true);
    });

    it("改訂先（得意先宛）への調整（単価変更）は集約ルート経由でできる", () => {
      const { estimate, revised, revisedItem } = buildRevisedEstimate();

      estimate.changeItemUnitPrice(revised.id, revisedItem.id, Money.fromMajorUnits(1000));

      expect(revisedItem.unitPrice.equals(Money.fromMajorUnits(1000))).toBe(true);
    });

    it("改訂先を削除すると凍結が自動的に解け、改訂元が編集可能に戻る", () => {
      const { estimate, source, revised } = buildRevisedEstimate();

      estimate.removeVariation(revised.id);

      // 系譜（出自を持つ改訂先）が消えたので凍結は導出されなくなる
      estimate.changeOverallDiscount(source.id, Money.fromMajorUnits(100));
      expect(estimate.variations[0]!.overallDiscount.equals(Money.fromMajorUnits(100))).toBe(true);
    });
  });
});
