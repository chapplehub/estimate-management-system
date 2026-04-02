/**
 * 役職データ転送オブジェクト
 * 読み取り専用のデータ表現（軽量）
 */
export type PositionDTO = {
  id: string;
  positionCd: string;
  name: string;
  superiorPositionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};
