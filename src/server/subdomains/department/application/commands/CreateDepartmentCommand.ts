import { Department } from "@subdomains/department/domain/entities/Department";
import { DepartmentRepository } from "@subdomains/department/domain/repositories/DepartmentRepository";
import { DepartmentCdDuplicationCheckDomainService } from "@subdomains/department/domain/services/DepartmentCdDuplicationCheckDomainService";
import { DepartmentCd } from "@subdomains/department/domain/values/DepartmentCd";
import { DepartmentName } from "@subdomains/department/domain/values/DepartmentName";
import { Abbreviation } from "@subdomains/department/domain/values/Abbreviation";
import { ValidationError } from "@server/shared/errors/DomainError";

export type CreateDepartmentInput = {
  departmentCd: string;
  name: string;
  abbreviation: string;
  displayOrder?: number;
  parentId?: string | null;
};

/**
 * 部署新規登録コマンド
 */
export class CreateDepartmentCommand {
  public constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly departmentCdDuplicationCheckDomainService: DepartmentCdDuplicationCheckDomainService
  ) {}

  async execute(input: CreateDepartmentInput): Promise<Department> {
    const departmentCd = new DepartmentCd(input.departmentCd);

    // 部署コードの重複チェック
    const isCdDuplicated =
      await this.departmentCdDuplicationCheckDomainService.execute(departmentCd);
    if (isCdDuplicated) {
      throw new ValidationError(`既に存在する部署コードです: CD=${departmentCd.value}`);
    }

    // 親部署が指定されている場合、存在確認
    if (input.parentId) {
      const parentDepartment = await this.departmentRepository.findById(input.parentId);
      if (!parentDepartment) {
        throw new ValidationError(`親部署が存在しません: ID=${input.parentId}`);
      }
      if (!parentDepartment.isActive) {
        throw new ValidationError(
          `無効な部署を親部署に設定することはできません: ID=${input.parentId}`
        );
      }
    }

    const name = new DepartmentName(input.name);
    const abbreviation = new Abbreviation(input.abbreviation);

    const newDepartment = Department.create(
      departmentCd,
      name,
      abbreviation,
      input.displayOrder ?? 0,
      input.parentId ?? null
    );

    return await this.departmentRepository.save(newDepartment);
  }
}
