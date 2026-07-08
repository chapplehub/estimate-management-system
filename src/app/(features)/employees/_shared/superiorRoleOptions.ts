import type { PositionDTO } from "@subdomains/position/application/queries/dto/PositionDTO";
import type { RoleDTO } from "@subdomains/role/application/queries/dto/RoleDTO";

/**
 * 課員の上位役割候補（課長級のみ）をフォーム供給用の {id,name}[] に絞り込む（ADR-20260707-k4e）。
 *
 * 課長級＝役職階層の葉（下位役職を持たない役職）に属する役割。役職は superiorPositionId で
 * 1本の鎖を成すため、葉＝「他のどの役職からも superiorPositionId として参照されない役職」。
 * 純関数として page.tsx から役割・役職の findAll 結果を渡して使う（DDD: 表示整形はプレゼン層）。
 *
 * @param roles 全役割 DTO（positionId を持つ）。呼び出し側の並び順を保つ。
 * @param positions 全役職 DTO（superiorPositionId を持つ）
 * @returns 課長級役割の {id,name}[]（roles の順序を維持）
 */
export function filterKachouTierRoleOptions(
  roles: RoleDTO[],
  positions: PositionDTO[]
): { id: string; name: string }[] {
  // 他役職の上位として参照されている役職ID集合（＝葉ではない役職）
  const referencedSuperiorIds = new Set(
    positions
      .map((position) => position.superiorPositionId)
      .filter((id): id is string => id !== null)
  );
  const leafPositionIds = new Set(
    positions.filter((position) => !referencedSuperiorIds.has(position.id)).map((p) => p.id)
  );

  return roles
    .filter((role) => leafPositionIds.has(role.positionId))
    .map((role) => ({ id: role.id, name: role.name }));
}
