import { IDepartmentRepository } from "@subdomains/department/domain/repositories/IDepartmentRepository";
import { DepartmentCd } from "@subdomains/department/domain/values/DepartmentCd";

/**
 * 部署コード重複チェックドメインサービス
 *
 * 部署コードが既に使用されているかどうかを確認する。
 */
export class DepartmentCdDuplicationCheckDomainService {
  constructor(private departmentRepository: IDepartmentRepository) {}

  /**
   * 部署コードが重複しているかチェック
   *
   * @param departmentCd チェック対象の部署コード
   * @returns 重複している場合は true
   */
  async execute(departmentCd: DepartmentCd): Promise<boolean> {
    const existingDepartment =
      await this.departmentRepository.findByDepartmentCd(departmentCd);
    return !!existingDepartment;
  }
}
