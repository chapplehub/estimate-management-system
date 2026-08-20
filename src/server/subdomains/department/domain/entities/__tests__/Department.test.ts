import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Abbreviation } from "../../values/Abbreviation";
import { DepartmentCd } from "../../values/DepartmentCd";
import { DepartmentId } from "../../values/DepartmentId";
import { DepartmentName } from "../../values/DepartmentName";
import { Department } from "../Department";

describe("Department", () => {
  // テスト用のValue Objects
  const createTestDepartment = (overrides?: {
    departmentCd?: DepartmentCd;
    name?: DepartmentName;
    abbreviation?: Abbreviation;
    parentId?: DepartmentId | null;
  }) => {
    return Department.create(
      overrides?.departmentCd ?? new DepartmentCd("DEPT001"),
      overrides?.name ?? new DepartmentName("営業部"),
      overrides?.abbreviation ?? new Abbreviation("営業"),
      overrides?.parentId ?? null
    );
  };

  describe("create", () => {
    it("新規部署を作成できる", () => {
      const dept = createTestDepartment();

      expect(dept.id).toBeDefined();
      expect(dept.departmentCd.value).toBe("DEPT001");
      expect(dept.name.value).toBe("営業部");
      expect(dept.abbreviation.value).toBe("営業");
      expect(dept.isActive).toBe(true);
      expect(dept.parentId).toBeNull();
      expect(dept.createdAt).toBeInstanceOf(Date);
      expect(dept.updatedAt).toBeInstanceOf(Date);
    });

    it("親部署を指定して作成できる", () => {
      const parentId = DepartmentId.generate();
      const dept = createTestDepartment({ parentId });

      expect(dept.parentId).toBe(parentId);
    });
  });

  describe("reconstruct", () => {
    it("DBから部署を再構築できる", () => {
      const id = DepartmentId.generate();
      const parentId = DepartmentId.generate();
      const createdAt = new Date("2024-01-01");
      const updatedAt = new Date("2024-06-01");

      const dept = Department.reconstruct(
        id,
        new DepartmentCd("DEPT001"),
        new DepartmentName("営業部"),
        new Abbreviation("営業"),
        false,
        parentId,
        createdAt,
        updatedAt
      );

      expect(dept.id).toBe(id);
      expect(dept.departmentCd.value).toBe("DEPT001");
      expect(dept.name.value).toBe("営業部");
      expect(dept.abbreviation.value).toBe("営業");
      expect(dept.isActive).toBe(false);
      expect(dept.parentId).toBe(parentId);
      expect(dept.createdAt).toBe(createdAt);
      expect(dept.updatedAt).toBe(updatedAt);
    });
  });

  describe("changeName", () => {
    it("部署名を変更できる", () => {
      const dept = createTestDepartment();
      const originalUpdatedAt = dept.updatedAt;

      // 少し待ってから変更（updatedAtの更新を確認するため）
      dept.changeName(new DepartmentName("総務部"));

      expect(dept.name.value).toBe("総務部");
      expect(dept.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  describe("changeAbbreviation", () => {
    it("略称を変更できる", () => {
      const dept = createTestDepartment();

      dept.changeAbbreviation(new Abbreviation("総務"));

      expect(dept.abbreviation.value).toBe("総務");
    });
  });

  describe("changeParent", () => {
    it("親部署を変更できる", () => {
      const dept = createTestDepartment();
      const newParentId = DepartmentId.generate();

      dept.changeParent(newParentId);

      expect(dept.parentId).toBe(newParentId);
    });

    it("ルート部署に変更できる", () => {
      const dept = createTestDepartment({ parentId: DepartmentId.generate() });

      dept.changeParent(null);

      expect(dept.parentId).toBeNull();
    });

    it("自分自身を親にするとエラー", () => {
      const dept = createTestDepartment();

      expect(() => dept.changeParent(dept.id)).toThrow(BusinessRuleViolationError);
      expect(() => dept.changeParent(dept.id)).toThrow("自分自身を親部署にすることはできません");
    });
  });

  describe("activate / deactivate", () => {
    it("部署を無効化できる", () => {
      const dept = createTestDepartment();
      expect(dept.isActive).toBe(true);

      dept.deactivate();

      expect(dept.isActive).toBe(false);
    });

    it("部署を有効化できる", () => {
      const dept = Department.reconstruct(
        DepartmentId.generate(),
        new DepartmentCd("DEPT001"),
        new DepartmentName("営業部"),
        new Abbreviation("営業"),
        false, // 無効状態で再構築
        null,
        new Date(),
        new Date()
      );
      expect(dept.isActive).toBe(false);

      dept.activate();

      expect(dept.isActive).toBe(true);
    });
  });

  describe("isRoot", () => {
    it("parentIdがnullならルート部署", () => {
      const dept = createTestDepartment({ parentId: null });

      expect(dept.isRoot()).toBe(true);
    });

    it("parentIdがあればルート部署ではない", () => {
      const dept = createTestDepartment({ parentId: DepartmentId.generate() });

      expect(dept.isRoot()).toBe(false);
    });
  });
});
