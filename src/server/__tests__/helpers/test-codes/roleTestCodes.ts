import { defineTestCodes } from "./defineTestCodes";

/**
 * `roleCd` 空間の共有DBテストコード・レジストリ（#608 / ADR 20260715-f71）。
 *
 * `roleCd` を使う role/employee 系 DB統合テストの**唯一の真実（SoT）**。各テストは自分の
 * 役割コードをここから引き（ハードコードしない）、cleanup も `codes` を使う。同一コードの
 * 二重割当はオブジェクトリテラルの重複キー＝**TS1117** でコンパイル時（pre-push `tsc`・
 * エディタ）に弾かれる。詳細は `defineTestCodes` と ADR を参照。
 *
 * ## 帯
 * - 形式 `/^ROLE9\d{2}$/`（9xx 帯）。seed 済み正準マスタ `ROLE001-015` とは帯で構造的に分離。
 * - `owner` は所有テストの論理名（`<subdomain>.<suite>`）。同名 owner が employeeTestCodes 側に
 *   もある場合、それは同じテストが両空間のコードを持つことを表す。
 *
 * ## スコープ外
 * - 得意先・商品・納品先ほかの空間 → #611。
 * - estimate/approval 系フィクスチャが使う役割コードは現状 `roleCd` の 9xx 帯に無く、本レジストリ対象外。
 */
export const roleTestCodes = defineTestCodes(/^ROLE9\d{2}$/, {
  // role サブドメイン
  ROLE901: { owner: "role.repository", use: "first" },
  ROLE902: { owner: "role.repository", use: "second" },
  ROLE903: { owner: "role.repository", use: "third" },
  ROLE921: { owner: "role.getRolesByPosition", use: "first" },
  ROLE922: { owner: "role.getRolesByPosition", use: "second" },
  ROLE923: { owner: "role.findRoleIdsWithMembers", use: "first" },
  ROLE924: { owner: "role.findRoleIdsWithMembers", use: "second" },
  ROLE931: { owner: "role.getRoleById", use: "only" },
  ROLE933: { owner: "role.hasMember", use: "first" },
  ROLE934: { owner: "role.hasMember", use: "second" },
  ROLE941: { owner: "role.getAllRoles", use: "first" },
  ROLE942: { owner: "role.getAllRoles", use: "second" },
  ROLE943: { owner: "role.getRoleByRoleCd", use: "only" },
  ROLE951: { owner: "role.searchRoles", use: "first" },
  ROLE952: { owner: "role.searchRoles", use: "second" },
  ROLE953: { owner: "role.searchRoles", use: "third" },
  ROLE957: { owner: "role.isSoleMember", use: "first" },
  ROLE958: { owner: "role.isSoleMember", use: "second" },
  ROLE961: { owner: "role.deleteCommand", use: "first" },
  ROLE962: { owner: "role.deleteCommand", use: "second" },
  // ROLE974-976: role.updateCommand は元々 ROLE971-973 を employee.roleNames と二重占有していた
  // ため空き帯へ退避（#608 の実害解消）。
  ROLE974: { owner: "role.updateCommand", use: "first" },
  ROLE975: { owner: "role.updateCommand", use: "second" },
  ROLE976: { owner: "role.updateCommand", use: "third" },
  ROLE981: { owner: "role.createCommand", use: "first" },
  ROLE982: { owner: "role.createCommand", use: "second" },
  ROLE993: { owner: "role.superiorKachouTier", use: "first" },
  ROLE994: { owner: "role.superiorKachouTier", use: "second" },
  ROLE995: { owner: "role.superiorValidation", use: "first" },
  ROLE996: { owner: "role.superiorValidation", use: "second" },
  ROLE997: { owner: "role.roleNameDuplication", use: "only" },
  ROLE998: { owner: "role.roleCdDuplication", use: "only" },

  // employee サブドメイン（employeeCd テストが従属的に作る役割）
  ROLE911: { owner: "employee.findSuperiorRoleId", use: "first" },
  ROLE912: { owner: "employee.findSuperiorRoleId", use: "second" },
  ROLE913: { owner: "employee.findSuperiorRoleId", use: "third" },
  ROLE944: { owner: "employee.createCommand", use: "first" },
  ROLE959: { owner: "employee.createCommand", use: "second" },
  // ROLE945-946: employee.repository は元々 ROLE951-952 を role.searchRoles と二重占有していた
  // ため空き帯へ退避（#608 の実害解消）。
  ROLE945: { owner: "employee.repository", use: "first" },
  ROLE946: { owner: "employee.repository", use: "second" },
  ROLE954: { owner: "employee.updateCommand", use: "first" },
  ROLE955: { owner: "employee.updateCommand", use: "second" },
  ROLE960: { owner: "employee.updateCommand", use: "third" },
  ROLE956: { owner: "employee.assignedRoleId", use: "only" },
  ROLE963: { owner: "employee.explicitSuperiorRoleId", use: "first" },
  ROLE964: { owner: "employee.explicitSuperiorRoleId", use: "second" },
  ROLE971: { owner: "employee.roleNames", use: "assignedRole" },
  ROLE972: { owner: "employee.roleNames", use: "seniorRole" },
  ROLE973: { owner: "employee.roleNames", use: "leafRole" },
});
