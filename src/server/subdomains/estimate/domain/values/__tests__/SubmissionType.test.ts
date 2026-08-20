import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { SubmissionType } from "../SubmissionType";

describe("SubmissionType", () => {
  describe("static インスタンス", () => {
    it("CUSTOMER を取得できる", () => {
      expect(SubmissionType.CUSTOMER.value).toBe("CUSTOMER");
    });

    it("DELIVERY_LOCATION を取得できる", () => {
      expect(SubmissionType.DELIVERY_LOCATION.value).toBe("DELIVERY_LOCATION");
    });
  });

  describe("from() — Prisma 値からの生成", () => {
    it("'CUSTOMER' から CUSTOMER が返る（同一インスタンス）", () => {
      expect(SubmissionType.from("CUSTOMER")).toBe(SubmissionType.CUSTOMER);
    });

    it("'DELIVERY_LOCATION' から DELIVERY_LOCATION が返る", () => {
      expect(SubmissionType.from("DELIVERY_LOCATION")).toBe(SubmissionType.DELIVERY_LOCATION);
    });

    it("不正な値はエラー", () => {
      expect(() => SubmissionType.from("INVALID")).toThrow(ValidationError);
      expect(() => SubmissionType.from("INVALID")).toThrow("不正な提出先区分です");
    });

    it("空文字はエラー", () => {
      expect(() => SubmissionType.from("")).toThrow(ValidationError);
    });
  });

  describe("判定メソッド", () => {
    it("CUSTOMER は isCustomer()=true, isDeliveryLocation()=false", () => {
      expect(SubmissionType.CUSTOMER.isCustomer()).toBe(true);
      expect(SubmissionType.CUSTOMER.isDeliveryLocation()).toBe(false);
    });

    it("DELIVERY_LOCATION は isCustomer()=false, isDeliveryLocation()=true", () => {
      expect(SubmissionType.DELIVERY_LOCATION.isCustomer()).toBe(false);
      expect(SubmissionType.DELIVERY_LOCATION.isDeliveryLocation()).toBe(true);
    });
  });

  describe("label — 業務表示名", () => {
    it("CUSTOMER のラベルは「得意先向け」", () => {
      expect(SubmissionType.CUSTOMER.label).toBe("得意先向け");
    });

    it("DELIVERY_LOCATION のラベルは「納品先向け」", () => {
      expect(SubmissionType.DELIVERY_LOCATION.label).toBe("納品先向け");
    });
  });

  describe("equals — 値オブジェクト等価判定", () => {
    it("同じ静的インスタンスは equals=true", () => {
      expect(SubmissionType.CUSTOMER.equals(SubmissionType.CUSTOMER)).toBe(true);
    });

    it("異なる静的インスタンスは equals=false", () => {
      expect(SubmissionType.CUSTOMER.equals(SubmissionType.DELIVERY_LOCATION)).toBe(false);
    });
  });
});
