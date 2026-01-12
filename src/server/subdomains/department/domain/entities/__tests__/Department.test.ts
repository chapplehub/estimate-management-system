import { describe, it, expect, beforeEach } from "vitest";
import { Department } from "../Department";
import { DepartmentCd } from "../../values/DepartmentCd";
import { DepartmentName } from "../../values/DepartmentName";
import { Abbreviation } from "../../values/Abbreviation";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("Department", () => {
  // テスト用のValue Objects
  const createTestDepartment = (overrides?: {
    departmentCd?: DepartmentCd;
    name?: DepartmentName;
    abbreviation?: Abbreviation;
    displayOrder?: number;
    parentId?: string | null;
  }) => {
    return Department.create(
      overrides?.departmentCd ?? new DepartmentCd("DEPT001"),
      overrides?.name ?? new DepartmentName("営業部"),
      overrides?.abbreviation ?? new Abbreviation("営業"),
      overrides?.displayOrder ?? 0,
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
      expect(dept.displayOrder).toBe(0);
      expect(dept.isActive).toBe(true);
      expect(dept.parentId).toBeNull();
      expect(dept.createdAt).toBeInstanceOf(Date);
      expect(dept.updatedAt).toBeInstanceOf(Date);
    });

    it("親部署を指定して作成できる", () => {
      const parentId = "parent-dept-id";
      const dept = createTestDepartment({ parentId });

      expect(dept.parentId).toBe(parentId);
    });

    it("表示順を指定して作成できる", () => {
      const dept = createTestDepartment({ displayOrder: 10 });

      expect(dept.displayOrder).toBe(10);
    });

    it("表示順が負の値だとエラー", () => {
      expect(() => createTestDepartment({ displayOrder: -1 })).toThrow(
        ValidationError
      );
      expect(() => createTestDepartment({ displayOrder: -1 })).toThrow(
        "表示順は0以上である必要があります"
      );
    });

    it("表示順が小数だとエラー", () => {
      expect(() => createTestDepartment({ displayOrder: 1.5 })).toThrow(
        ValidationError
      );
      expect(() => createTestDepartment({ displayOrder: 1.5 })).toThrow(
        "表示順は整数である必要があります"
      );
    });
  });

  describe("reconstruct", () => {
    it("DBから部署を再構築できる", () => {
      const id = "test-id";
      const createdAt = new Date("2024-01-01");
      const updatedAt = new Date("2024-06-01");

      const dept = Department.reconstruct(
        id,
        new DepartmentCd("DEPT001"),
        new DepartmentName("営業部"),
        new Abbreviation("営業"),
        5,
        false,
        "parent-id",
        createdAt,
        updatedAt
      );

      expect(dept.id).toBe(id);
      expect(dept.departmentCd.value).toBe("DEPT001");
      expect(dept.name.value).toBe("営業部");
      expect(dept.abbreviation.value).toBe("営業");
      expect(dept.displayOrder).toBe(5);
      expect(dept.isActive).toBe(false);
      expect(dept.parentId).toBe("parent-id");
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
      expect(dept.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });
  });

  describe("changeAbbreviation", () => {
    it("略称を変更できる", () => {
      const dept = createTestDepartment();

      dept.changeAbbreviation(new Abbreviation("総務"));

      expect(dept.abbreviation.value).toBe("総務");
    });
  });

  describe("changeDisplayOrder", () => {
    it("表示順を変更できる", () => {
      const dept = createTestDepartment();

      dept.changeDisplayOrder(10);

      expect(dept.displayOrder).toBe(10);
    });

    it("負の値はエラー", () => {
      const dept = createTestDepartment();

      expect(() => dept.changeDisplayOrder(-1)).toThrow(ValidationError);
    });
  });

  describe("changeParent", () => {
    it("親部署を変更できる", () => {
      const dept = createTestDepartment();

      dept.changeParent("new-parent-id");

      expect(dept.parentId).toBe("new-parent-id");
    });

    it("ルート部署に変更できる", () => {
      const dept = createTestDepartment({ parentId: "some-parent" });

      dept.changeParent(null);

      expect(dept.parentId).toBeNull();
    });

    it("自分自身を親にするとエラー", () => {
      const dept = createTestDepartment();

      expect(() => dept.changeParent(dept.id)).toThrow(ValidationError);
      expect(() => dept.changeParent(dept.id)).toThrow(
        "自分自身を親部署にすることはできません"
      );
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
        "test-id",
        new DepartmentCd("DEPT001"),
        new DepartmentName("営業部"),
        new Abbreviation("営業"),
        0,
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
      const dept = createTestDepartment({ parentId: "parent-id" });

      expect(dept.isRoot()).toBe(false);
    });
  });
});
