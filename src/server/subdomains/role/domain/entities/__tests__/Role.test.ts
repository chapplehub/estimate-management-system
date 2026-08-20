import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { describe, it, expect } from "vitest";
import { Role } from "../Role";
import { RoleCd } from "../../values/RoleCd";
import { RoleId } from "../../values/RoleId";
import { RoleName } from "../../values/RoleName";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";

describe("Role", () => {
  const defaultPositionId = PositionId.generate();
  const defaultSuperiorRoleId = RoleId.generate();

  const createTestRole = (overrides?: {
    roleCd?: RoleCd;
    name?: RoleName;
    positionId?: PositionId;
    superiorRoleId?: RoleId | null;
  }) => {
    return Role.create(
      overrides?.roleCd ?? new RoleCd("ROLE001"),
      overrides?.name ?? new RoleName("大阪市南課長"),
      overrides?.positionId ?? defaultPositionId,
      overrides?.superiorRoleId !== undefined ? overrides.superiorRoleId : defaultSuperiorRoleId
    );
  };

  describe("create", () => {
    it("新規役割を作成できる", () => {
      const role = createTestRole();

      expect(role.id).toBeDefined();
      expect(role.roleCd.value).toBe("ROLE001");
      expect(role.name.value).toBe("大阪市南課長");
      expect(role.positionId).toBe(defaultPositionId);
      expect(role.superiorRoleId).toBe(defaultSuperiorRoleId);
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

      const roleId = RoleId.generate();
      const positionId = PositionId.generate();
      const superiorRoleId = RoleId.generate();

      const role = Role.reconstruct(
        roleId,
        new RoleCd("ROLE001"),
        new RoleName("営業部長"),
        positionId,
        superiorRoleId,
        createdAt,
        updatedAt
      );

      expect(role.id).toBe(roleId);
      expect(role.roleCd.value).toBe("ROLE001");
      expect(role.name.value).toBe("営業部長");
      expect(role.positionId).toBe(positionId);
      expect(role.superiorRoleId).toBe(superiorRoleId);
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
      const newSuperiorRoleId = RoleId.generate();

      role.changeSuperiorRole(newSuperiorRoleId);

      expect(role.superiorRoleId).toBe(newSuperiorRoleId);
      expect(role.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it("上位役割をnullに変更できる", () => {
      const role = createTestRole({ superiorRoleId: RoleId.generate() });

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
