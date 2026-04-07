import { describe, it, expect } from "vitest";
import { Position } from "../Position";
import { PositionCd } from "../../values/PositionCd";
import { PositionId } from "../../values/PositionId";
import { PositionName } from "../../values/PositionName";

describe("Position", () => {
  const defaultId = PositionId.generate();
  const defaultSuperiorId = PositionId.generate();

  const createTestPosition = (overrides?: {
    id?: PositionId;
    positionCd?: PositionCd;
    name?: PositionName;
    superiorPositionId?: PositionId | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) => {
    const now = new Date();
    return Position.reconstruct(
      overrides?.id ?? defaultId,
      overrides?.positionCd ?? new PositionCd("POS001"),
      overrides?.name ?? new PositionName("課長"),
      overrides?.superiorPositionId !== undefined
        ? overrides.superiorPositionId
        : defaultSuperiorId,
      overrides?.createdAt ?? now,
      overrides?.updatedAt ?? now
    );
  };

  describe("reconstruct", () => {
    it("役職を再構築できる", () => {
      const position = createTestPosition();

      expect(position.id.value).toBe(defaultId.value);
      expect(position.positionCd.value).toBe("POS001");
      expect(position.name.value).toBe("課長");
      expect(position.superiorPositionId?.value).toBe(defaultSuperiorId.value);
    });

    it("上位役職がnullの場合も再構築できる", () => {
      const position = createTestPosition({ superiorPositionId: null });

      expect(position.superiorPositionId).toBeNull();
    });

    it("タイムスタンプが保持される", () => {
      const createdAt = new Date("2025-01-01");
      const updatedAt = new Date("2025-06-01");
      const position = createTestPosition({ createdAt, updatedAt });

      expect(position.createdAt).toEqual(createdAt);
      expect(position.updatedAt).toEqual(updatedAt);
    });
  });

  describe("isTopLevel", () => {
    it("上位役職がnullの場合はtrueを返す（社長）", () => {
      const position = createTestPosition({ superiorPositionId: null });

      expect(position.isTopLevel()).toBe(true);
    });

    it("上位役職がある場合はfalseを返す", () => {
      const position = createTestPosition({ superiorPositionId: PositionId.generate() });

      expect(position.isTopLevel()).toBe(false);
    });
  });

  describe("ENTITY_NAME", () => {
    it("エンティティ名が正しい", () => {
      expect(Position.ENTITY_NAME).toBe("役職");
    });
  });
});
