import { describe, expect, it } from "vitest";
import { ValidationError } from "@server/shared/errors/DomainError";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { CompanyId } from "@server/shared/domain/values/CompanyId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";

/** テスト用の有効なUUIDv7 */
const VALID_UUID_V7 = "019573a0-7a00-7000-8000-000000000001";
const VALID_UUID_V7_2 = "019573a0-7a00-7000-8000-000000000002";

describe("EntityId Value Objects", () => {
  describe("バリデーション", () => {
    it("有効なUUIDv7を受け入れる", () => {
      const id = new EmployeeId(VALID_UUID_V7);
      expect(id.value).toBe(VALID_UUID_V7);
    });

    it("大文字のUUIDv7を受け入れる", () => {
      const upper = VALID_UUID_V7.toUpperCase();
      const id = new EmployeeId(upper);
      expect(id.value).toBe(upper);
    });

    it("空文字を拒否する", () => {
      expect(() => new EmployeeId("")).toThrow(ValidationError);
    });

    it("不正な形式を拒否する", () => {
      expect(() => new EmployeeId("not-a-uuid")).toThrow(ValidationError);
    });

    it("UUIDv4を拒否する（version nibbleが4）", () => {
      expect(() => new EmployeeId("550e8400-e29b-41d4-a716-446655440000")).toThrow(ValidationError);
    });

    it("ハイフンなしのUUIDを拒否する", () => {
      expect(() => new EmployeeId("019573a07a0070008000000000000001")).toThrow(ValidationError);
    });
  });

  describe("generate", () => {
    it("EmployeeId.generate() は有効なEmployeeIdを返す", () => {
      const id = EmployeeId.generate();
      expect(id).toBeInstanceOf(EmployeeId);
      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("generate() は毎回異なるIDを返す", () => {
      const id1 = EmployeeId.generate();
      const id2 = EmployeeId.generate();
      expect(id1.value).not.toBe(id2.value);
    });

    it("各ID型のgenerate()が正しい型を返す", () => {
      expect(CustomerId.generate()).toBeInstanceOf(CustomerId);
      expect(CompanyId.generate()).toBeInstanceOf(CompanyId);
      expect(DepartmentId.generate()).toBeInstanceOf(DepartmentId);
      expect(DeliveryLocationId.generate()).toBeInstanceOf(DeliveryLocationId);
      expect(PositionId.generate()).toBeInstanceOf(PositionId);
      expect(RoleId.generate()).toBeInstanceOf(RoleId);
    });
  });

  describe("equals", () => {
    it("同じ値のIDは等しい", () => {
      const a = new EmployeeId(VALID_UUID_V7);
      const b = new EmployeeId(VALID_UUID_V7);
      expect(a.equals(b)).toBe(true);
    });

    it("異なる値のIDは等しくない", () => {
      const a = new EmployeeId(VALID_UUID_V7);
      const b = new EmployeeId(VALID_UUID_V7_2);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("型安全性", () => {
    it("異なるID型のequalsはfalseを返す", () => {
      const employeeId = new EmployeeId(VALID_UUID_V7);
      const customerId = new CustomerId(VALID_UUID_V7);
      // 同じ値でも異なるクラスなら false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(employeeId.equals(customerId as any)).toBe(false);
    });
  });
});
