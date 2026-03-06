import { PaginatedResult, PaginationOptions } from "@server/shared/queries/PaginatedResult";

import { DepartmentDTO } from "./dto/DepartmentDTO";
import { DepartmentSearchCriteria, DepartmentListOptions } from "./dto/DepartmentSearchCriteria";
import { DepartmentQueryService } from "./DepartmentQueryService";

export type SearchDepartmentsInput = {
  criteria: DepartmentSearchCriteria;
  options?: DepartmentListOptions;
};

export type SearchDepartmentsPaginatedInput = {
  criteria: DepartmentSearchCriteria;
  pagination: PaginationOptions;
  orderBy?: DepartmentListOptions["orderBy"];
};

/**
 * 部署検索クエリ
 */
export class SearchDepartmentsQuery {
  public constructor(private readonly departmentQueryService: DepartmentQueryService) {}

  async execute(input: SearchDepartmentsInput): Promise<DepartmentDTO[]> {
    return await this.departmentQueryService.search(input.criteria, input.options);
  }

  /**
   * ページネーション付きで検索を実行
   */
  async executeWithPagination(
    input: SearchDepartmentsPaginatedInput
  ): Promise<PaginatedResult<DepartmentDTO>> {
    const { criteria, pagination, orderBy } = input;
    const { page, pageSize } = pagination;

    // 総件数を取得
    const totalCount = await this.departmentQueryService.count(criteria);

    // 総ページ数を計算
    const totalPages = Math.ceil(totalCount / pageSize);

    // 現在のページが範囲外の場合は空配列を返す
    if (page < 1 || (totalPages > 0 && page > totalPages)) {
      return {
        items: [],
        totalCount,
        totalPages,
        currentPage: page,
        pageSize,
        hasNextPage: false,
        hasPreviousPage: page > 1,
      };
    }

    // データを取得
    const offset = (page - 1) * pageSize;
    const items = await this.departmentQueryService.search(criteria, {
      limit: pageSize,
      offset,
      orderBy,
    });

    return {
      items,
      totalCount,
      totalPages,
      currentPage: page,
      pageSize,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
