import { Department } from "@subdomains/department/domain/entities/Department";
import { DepartmentRepository } from "@subdomains/department/domain/repositories/DepartmentRepository";
import { DepartmentName } from "@subdomains/department/domain/values/DepartmentName";
import { Abbreviation } from "@subdomains/department/domain/values/Abbreviation";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";

export type UpdateDepartmentInput = {
  id: string;
  name?: string;
  abbreviation?: string;
  parentId?: string | null;
  isActive?: boolean;
};

/**
 * 部署更新コマンド
 */
export class UpdateDepartmentCommand {
  public constructor(private readonly departmentRepository: DepartmentRepository) {}

  async execute(input: UpdateDepartmentInput): Promise<Department> {
    const department = await this.departmentRepository.findById(input.id);
    if (!department) {
      throw new NotFoundEntityError(Department, { id: input.id });
    }

    // 部署名の更新
    if (input.name !== undefined) {
      department.changeName(new DepartmentName(input.name));
    }

    // 略称の更新
    if (input.abbreviation !== undefined) {
      department.changeAbbreviation(new Abbreviation(input.abbreviation));
    }

    // 親部署の更新
    if (input.parentId !== undefined) {
      // 循環参照チェック
      if (input.parentId !== null) {
        await this.validateNoCircularReference(department.id, input.parentId);
      }
      department.changeParent(input.parentId);
    }

    // 有効/無効の更新
    if (input.isActive !== undefined) {
      if (input.isActive) {
        department.activate();
      } else {
        // 子部署がある場合は無効化できない
        const children = await this.departmentRepository.findChildren(department.id);
        const activeChildren = children.filter((c) => c.isActive);
        if (activeChildren.length > 0) {
          throw new BusinessRuleViolationError(
            "有効な子部署が存在するため、この部署を無効化できません"
          );
        }
        department.deactivate();
      }
    }

    return await this.departmentRepository.save(department);
  }

  /**
   * 循環参照がないことを検証
   * 指定した親部署が、自分自身または自分の子孫でないことを確認
   */
  private async validateNoCircularReference(
    departmentId: string,
    newParentId: string
  ): Promise<void> {
    // 自分自身を親にできない（これは Entity 側でもチェックしているが念のため）
    if (departmentId === newParentId) {
      throw new BusinessRuleViolationError("自分自身を親部署にすることはできません");
    }

    // 新しい親部署が存在するか確認
    const newParent = await this.departmentRepository.findById(newParentId);
    if (!newParent) {
      throw new BusinessRuleViolationError(`親部署が存在しません: ID=${newParentId}`);
    }

    if (!newParent.isActive) {
      throw new BusinessRuleViolationError(
        `無効な部署を親部署に設定することはできません: ID=${newParentId}`
      );
    }

    // 新しい親部署の祖先を辿って、自分自身がいないことを確認
    let currentParentId: string | null = newParent.parentId;
    while (currentParentId !== null) {
      if (currentParentId === departmentId) {
        throw new BusinessRuleViolationError("循環参照が発生するため、この親部署は設定できません");
      }
      const parent = await this.departmentRepository.findById(currentParentId);
      if (!parent) {
        break;
      }
      currentParentId = parent.parentId;
    }
  }
}
