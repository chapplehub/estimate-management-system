/**
 * 部署データ転送オブジェクト
 * 読み取り専用のデータ表現（軽量）
 */
export type DepartmentDTO = {
  id: string;
  departmentCd: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 階層構造を含む部署DTO
 * ツリー表示などで使用
 */
export type DepartmentTreeDTO = DepartmentDTO & {
  children: DepartmentTreeDTO[];
};
