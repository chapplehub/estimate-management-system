import { describe, expect, test } from "vitest";
import { filterKachouTierRoleOptions } from "./superiorRoleOptions";
import type { PositionDTO } from "@subdomains/position/application/queries/dto/PositionDTO";
import type { RoleDTO } from "@subdomains/role/application/queries/dto/RoleDTO";

// 役職の1本鎖: 課長(pos-k) → 部長(pos-b) → 本部長(pos-h)。superiorPositionId は上位を指す。
// 葉＝他役職の上位として参照されない役職＝課長(pos-k)。
const positions: PositionDTO[] = [
  {
    id: "pos-k",
    positionCd: "POS001",
    name: "課長",
    superiorPositionId: "pos-b",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "pos-b",
    positionCd: "POS002",
    name: "部長",
    superiorPositionId: "pos-h",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "pos-h",
    positionCd: "POS003",
    name: "本部長",
    superiorPositionId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
];

function role(id: string, name: string, positionId: string): RoleDTO {
  return {
    id,
    roleCd: id,
    name,
    positionId,
    positionName: "",
    superiorRoleId: null,
    superiorRoleName: null,
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

describe("filterKachouTierRoleOptions", () => {
  test("課長級（葉役職）に属する役割のみを {id,name} で返す", () => {
    const roles = [
      role("r-k1", "営業一課長", "pos-k"),
      role("r-b1", "営業部長", "pos-b"),
      role("r-k2", "開発課長", "pos-k"),
      role("r-h1", "営業本部長", "pos-h"),
    ];

    const result = filterKachouTierRoleOptions(roles, positions);

    expect(result).toEqual([
      { id: "r-k1", name: "営業一課長" },
      { id: "r-k2", name: "開発課長" },
    ]);
  });

  test("入力 roles の順序を維持する", () => {
    const roles = [role("r-k2", "開発課長", "pos-k"), role("r-k1", "営業一課長", "pos-k")];

    const result = filterKachouTierRoleOptions(roles, positions);

    expect(result.map((r) => r.id)).toEqual(["r-k2", "r-k1"]);
  });

  test("課長級役割が無ければ空配列", () => {
    const roles = [role("r-b1", "営業部長", "pos-b")];

    expect(filterKachouTierRoleOptions(roles, positions)).toEqual([]);
  });
});
