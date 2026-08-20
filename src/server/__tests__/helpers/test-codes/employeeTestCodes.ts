import { defineTestCodes } from "./defineTestCodes";

/**
 * `employeeCd` 空間の共有DBテストコード・レジストリ（#608 / ADR 20260715-f71）。
 *
 * `employeeCd` を使う role/employee 系 DB統合テストの**唯一の真実（SoT）**。各テストは自分の
 * 従業員コードをここから引き（ハードコードしない）、cleanup も `codes` を使う。同一コードの
 * 二重割当は **TS1117** でコンパイル時に弾かれる。詳細は `defineTestCodes` と ADR を参照。
 *
 * ## 帯
 * - 形式 `/^EMP99\d{4}$/`（99xxxx 帯＝テスト帯）。seed 済み正準マスタに従業員は無い。
 * - `EMP999999` は「存在しない従業員」を検証する**永続化しないセンチネル**として複数テストが
 *   インラインで使う。行を挿入しないため衝突せず、本レジストリの管理対象外（採番禁止の予約値）。
 *
 * ## スコープ外
 * - estimate/approval 系フィクスチャの従業員コード `EMP999091-097`（`ensureEstimateFixtures` /
 *   `ensureApprovalFixtures` が調整済みの共有帯）は本レジストリ対象外。role/employee 系の
 *   flaky 発生源ではなく、共有フィクスチャ経由で採番が一元化されているため。→ 別途 #611 圏。
 */
export const employeeTestCodes = defineTestCodes(/^EMP99\d{4}$/, {
  // employee サブドメイン
  EMP990110: { owner: "employee.findSuperiorRoleId", use: "first" },
  EMP990111: { owner: "employee.findSuperiorRoleId", use: "second" },
  EMP990112: { owner: "employee.findSuperiorRoleId", use: "third" },
  EMP990113: { owner: "employee.findSuperiorRoleId", use: "fourth" },
  EMP990510: { owner: "employee.assignedRoleId", use: "first" },
  EMP990511: { owner: "employee.assignedRoleId", use: "second" },
  EMP990610: { owner: "employee.explicitSuperiorRoleId", use: "first" },
  EMP990611: { owner: "employee.explicitSuperiorRoleId", use: "second" },
  EMP990612: { owner: "employee.explicitSuperiorRoleId", use: "third" },
  EMP990710: { owner: "employee.roleNames", use: "first" },
  EMP990711: { owner: "employee.roleNames", use: "second" },
  EMP990712: { owner: "employee.roleNames", use: "third" },
  EMP990713: { owner: "employee.roleNames", use: "fourth" },
  EMP999001: { owner: "employee.repository", use: "first" },
  EMP999002: { owner: "employee.repository", use: "second" },
  EMP999003: { owner: "employee.repository", use: "third" },
  EMP999821: { owner: "employee.cdDuplication", use: "first" },
  EMP999822: { owner: "employee.cdDuplication", use: "second" },
  EMP999831: { owner: "employee.mailDuplication", use: "only" },
  EMP999909: { owner: "employee.deleteCommand", use: "only" },
  EMP999911: { owner: "employee.createCommand", use: "first" },
  EMP999914: { owner: "employee.createCommand", use: "second" },
  EMP999912: { owner: "employee.updateCommand", use: "first" },
  EMP999913: { owner: "employee.updateCommand", use: "second" },
  EMP999954: { owner: "employee.getById", use: "only" },
  EMP999955: { owner: "employee.getByEmployeeCd", use: "only" },
  EMP999957: { owner: "employee.searchEmployees", use: "first" },
  EMP999958: { owner: "employee.searchEmployees", use: "second" },
  EMP999959: { owner: "employee.searchEmployees", use: "third" },
  EMP999960: { owner: "employee.searchEmployees", use: "fourth" },

  // role サブドメイン（roleCd テストが従属的に作る従業員）
  EMP990210: { owner: "role.findRoleIdsWithMembers", use: "only" },
  EMP990310: { owner: "role.hasMember", use: "first" },
  EMP990311: { owner: "role.hasMember", use: "second" },
  EMP990410: { owner: "role.repository", use: "first" },
  EMP990411: { owner: "role.repository", use: "second" },
  // EMP990810-811: role.isSoleMember は元々 EMP990710-711 を employee.roleNames と二重占有して
  // いたため空き帯へ退避（#608 の実害解消）。
  EMP990810: { owner: "role.isSoleMember", use: "first" },
  EMP990811: { owner: "role.isSoleMember", use: "second" },
});
