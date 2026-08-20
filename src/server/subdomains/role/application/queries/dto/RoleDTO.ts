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
  /** 楽観ロックトークン（ADR-0039）。編集フォームで往復させ更新時の競合検知に使う */
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
