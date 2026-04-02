/**
 * 役割データ転送オブジェクト
 * 読み取り専用のデータ表現（軽量）
 * position, superiorRole の名前をJOINして返す
 */
export type RoleDTO = {
  id: string;
  roleCd: string;
  name: string;
  positionId: string;
  positionName: string;
  superiorRoleId: string | null;
  superiorRoleName: string | null;
  createdAt: Date;
  updatedAt: Date;
};
