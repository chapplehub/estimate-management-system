import { describe, it, expect } from "vitest";
import { Role } from "../Role";
import { RoleCd } from "../../values/RoleCd";
import { RoleName } from "../../values/RoleName";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";

describe("Role", () => {
  const createTestRole = (overrides?: {
    roleCd?: RoleCd;
    name?: RoleName;
    positionId?: string;
    superiorRoleId?: string | null;
  }) => {
    return Role.create(
      overrides?.roleCd ?? new RoleCd("ROLE001"),
      overrides?.name ?? new RoleName("大阪市南課長"),
      overrides?.positionId ?? "position-id-001",
      overrides?.superiorRoleId !== undefined ? overrides.superiorRoleId : "superior-role-id"
    );
  };

  describe("create", () => {
    it("新規役割を作成できる", () => {
      const role = createTestRole();

      expect(role.id).toBeDefined();
      expect(role.roleCd.value).toBe("ROLE001");
      expect(role.name.value).toBe("大阪市南課長");
      expect(role.positionId).toBe("position-id-001");
      expect(role.superiorRoleId).toBe("superior-role-id");
      expect(role.createdAt).toBeInstanceOf(Date);
      expect(role.updatedAt).toBeInstanceOf(Date);
    });

    it("上位役割なしで作成できる", () => {
      const role = createTestRole({ superiorRoleId: null });

      expect(role.superiorRoleId).toBeNull();
    });
  });

  describe("reconstruct", () => {
    it("DBから役割を再構築できる", () => {
      const createdAt = new Date("2025-01-01");
      const updatedAt = new Date("2025-06-01");

      const role = Role.reconstruct(
        "test-id",
        new RoleCd("ROLE001"),
        new RoleName("営業部長"),
        "position-id",
        "superior-id",
        createdAt,
        updatedAt
      );

      expect(role.id).toBe("test-id");
      expect(role.roleCd.value).toBe("ROLE001");
      expect(role.name.value).toBe("営業部長");
      expect(role.positionId).toBe("position-id");
      expect(role.superiorRoleId).toBe("superior-id");
      expect(role.createdAt).toEqual(createdAt);
      expect(role.updatedAt).toEqual(updatedAt);
    });
  });

  describe("changeName", () => {
    it("役割名を変更できる", () => {
      const role = createTestRole();
      const originalUpdatedAt = role.updatedAt;

      role.changeName(new RoleName("新しい役割名"));

      expect(role.name.value).toBe("新しい役割名");
      expect(role.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  describe("changeSuperiorRole", () => {
    it("上位役割を変更できる", () => {
      const role = createTestRole();
      const originalUpdatedAt = role.updatedAt;

      role.changeSuperiorRole("new-superior-id");

      expect(role.superiorRoleId).toBe("new-superior-id");
      expect(role.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it("上位役割をnullに変更できる", () => {
      const role = createTestRole({ superiorRoleId: "some-id" });

      role.changeSuperiorRole(null);

      expect(role.superiorRoleId).toBeNull();
    });

    it("自分自身を上位役割にするとエラー", () => {
      const role = createTestRole();

      expect(() => role.changeSuperiorRole(role.id)).toThrow(BusinessRuleViolationError);
      expect(() => role.changeSuperiorRole(role.id)).toThrow(
        "自分自身を上位役割にすることはできません"
      );
    });
  });

  describe("ENTITY_NAME", () => {
    it("エンティティ名が正しい", () => {
      expect(Role.ENTITY_NAME).toBe("役割");
    });
  });
});
