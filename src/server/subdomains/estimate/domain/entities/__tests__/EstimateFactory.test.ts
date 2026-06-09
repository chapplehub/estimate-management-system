import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";

import { EmergencyReason } from "../../values/EmergencyReason";
import { EstimateNumber } from "../../values/EstimateNumber";
import { FaultDescription } from "../../values/FaultDescription";
import { ItemName } from "../../values/ItemName";
import { Money } from "../../values/Money";
import { Quantity } from "../../values/Quantity";
import { SubmissionType } from "../../values/SubmissionType";
import { TaxRate } from "../../values/TaxRate";
import { TaxRoundingType } from "../../values/TaxRoundingType";
import { Unit } from "../../values/Unit";
import {
  EstimateFactory,
  type EstimateFactoryInput,
  type EstimateItemDescriptor,
} from "../EstimateFactory";

// 純ドメインテスト（DB 不要）。FK 整合は問わないため固定 UUIDv7 を使う。
const UUID = "00000000-0000-7000-8000-000000000001";

function item(overrides: Partial<EstimateItemDescriptor> = {}): EstimateItemDescriptor {
  return {
    productId: new ProductId(UUID),
    sortOrder: 1,
    itemName: new ItemName("テスト商品"),
    quantity: new Quantity(2),
    unit: new Unit("個"),
    unitPrice: Money.fromMajorUnits(1000),
    ...overrides,
  };
}

function baseInput(overrides: Partial<EstimateFactoryInput> = {}): EstimateFactoryInput {
  return {
    estimateNumber: EstimateNumber.parse("N2500001"),
    estimateDate: new Date("2025-04-01T00:00:00.000Z"),
    deadline: new Date("2025-04-30T00:00:00.000Z"),
    submissionType: SubmissionType.CUSTOMER,
    customerId: new CustomerId(UUID),
    deliveryLocationId: new DeliveryLocationId(UUID),
    taxRate: new TaxRate(0.1),
    taxRoundingType: TaxRoundingType.ROUND_DOWN,
    createdBy: new EmployeeId(UUID),
    departmentId: new DepartmentId(UUID),
    variations: [{ variationNumber: 1, items: [item()] }],
    ...overrides,
  };
}

describe("EstimateFactory", () => {
  it("VO 記述子から集約を組み立て、明細・バリエーションの金額が算出される", () => {
    const estimate = EstimateFactory.create(
      baseInput({
        variations: [
          {
            variationNumber: 1,
            items: [
              item({
                sortOrder: 1,
                unitPrice: Money.fromMajorUnits(1000),
                quantity: new Quantity(2),
              }),
              item({
                sortOrder: 2,
                unitPrice: Money.fromMajorUnits(500),
                quantity: new Quantity(1),
              }),
            ],
          },
        ],
      })
    );

    expect(estimate.estimateNumber.value).toBe("N2500001");
    expect(estimate.variations).toHaveLength(1);
    const variation = estimate.variations[0];
    expect(variation.items).toHaveLength(2);
    // 1000*2 + 500*1 = 2500 が小計として算出される
    expect(variation.subtotal.majorUnits).toBe(2500);
    expect(estimate.repairDetail).toBeNull();
    expect(estimate.afterRepairDetail).toBeNull();
  });

  it("revisedDeliveryPrice を指定した明細には改訂明細詳細が構築される", () => {
    const estimate = EstimateFactory.create(
      baseInput({
        variations: [
          {
            variationNumber: 1,
            items: [item({ revisedDeliveryPrice: Money.fromMajorUnits(800) })],
          },
        ],
      })
    );

    const revised = estimate.variations[0].items[0].revisedDetail;
    expect(revised).not.toBeNull();
    expect(revised?.deliveryPrice.majorUnits).toBe(800);
  });

  it("REPAIR: repairDetail を構築し afterRepairDetail は null", () => {
    const estimate = EstimateFactory.create(
      baseInput({
        estimateNumber: EstimateNumber.parse("R2500001"),
        repairDetail: {
          targetProductId: new ProductId(UUID),
          faultDescription: new FaultDescription("電源が入らない"),
          scheduledRepairDate: new Date("2025-05-10T00:00:00.000Z"),
        },
      })
    );

    expect(estimate.estimateType.value).toBe("REPAIR");
    expect(estimate.repairDetail).not.toBeNull();
    expect(estimate.repairDetail?.faultDescription.value).toBe("電源が入らない");
    expect(estimate.afterRepairDetail).toBeNull();
  });

  it("AFTER_REPAIR: afterRepairDetail を構築し repairDetail は null", () => {
    const estimate = EstimateFactory.create(
      baseInput({
        estimateNumber: EstimateNumber.parse("A2500001"),
        afterRepairDetail: {
          targetProductId: new ProductId(UUID),
          faultDescription: new FaultDescription("基板焼損"),
          actualRepairDate: new Date("2025-03-20T00:00:00.000Z"),
          emergencyReason: new EmergencyReason("顧客ライン停止のため緊急対応"),
        },
      })
    );

    expect(estimate.estimateType.value).toBe("AFTER_REPAIR");
    expect(estimate.afterRepairDetail).not.toBeNull();
    expect(estimate.repairDetail).toBeNull();
  });

  it("バリエーション0件は集約ルートの空見積不可で BusinessRuleViolationError", () => {
    expect(() => EstimateFactory.create(baseInput({ variations: [] }))).toThrow(
      BusinessRuleViolationError
    );
  });

  it("estimateType とサブタイプ詳細の不整合は集約ルートが拒否する（ADR-0019）", () => {
    // NEW 見積番号なのに repairDetail を渡す → Estimate.create が整合性違反で throw
    expect(() =>
      EstimateFactory.create(
        baseInput({
          repairDetail: {
            targetProductId: new ProductId(UUID),
            faultDescription: new FaultDescription("電源が入らない"),
            scheduledRepairDate: new Date("2025-05-10T00:00:00.000Z"),
          },
        })
      )
    ).toThrow();
  });

  describe("buildVariationContent - C3/C4 用の番号なし内容構築", () => {
    it("番号なし内容から構築済み明細を含む VariationContent を生成する", () => {
      const content = EstimateFactory.buildVariationContent({
        items: [item({ unitPrice: Money.fromMajorUnits(1000), quantity: new Quantity(2) })],
        overallDiscount: Money.fromMajorUnits(500),
      });

      expect(content.items).toHaveLength(1);
      // 1000 × 2 = 2000
      expect(content.items[0].finalAmount.equals(Money.fromMajorUnits(2000))).toBe(true);
      expect(content.overallDiscount?.equals(Money.fromMajorUnits(500))).toBe(true);
    });
  });
});
