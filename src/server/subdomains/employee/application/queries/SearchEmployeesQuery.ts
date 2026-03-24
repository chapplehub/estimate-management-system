import { EmployeeQueryService } from "@subdomains/employee/application/queries/EmployeeQueryService";
import { EmployeeDTO } from "@subdomains/employee/application/queries/dto/EmployeeDTO";
import {
  EmployeeSearchCriteria,
  ListOptions,
} from "@subdomains/employee/application/queries/dto/EmployeeSearchCriteria";
import { PaginatedResult, PaginationOptions } from "@server/shared/queries/PaginatedResult";

export type SearchEmployeesInput = {
  criteria: EmployeeSearchCriteria;
  options?: ListOptions;
};

export type SearchEmployeesPaginatedInput = {
  criteria: EmployeeSearchCriteria;
  pagination: PaginationOptions;
  orderBy?: ListOptions["orderBy"];
};

/**
 * 検索条件に基づいて従業員を検索するクエリ
 */
export class SearchEmployeesQuery {
  public constructor(private readonly employeeQueryService: EmployeeQueryService) {}

  async execute(input: SearchEmployeesInput): Promise<EmployeeDTO[]> {
    return await this.employeeQueryService.search(input.criteria, input.options);
  }

  /**
   * ページネーション付きで検索を実行
   */
  async executeWithPagination(
    input: SearchEmployeesPaginatedInput
  ): Promise<PaginatedResult<EmployeeDTO>> {
    const { criteria, pagination, orderBy } = input;
    const { page, pageSize } = pagination;

    // 総件数を取得
    const totalCount = await this.employeeQueryService.count(criteria);

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
    const items = await this.employeeQueryService.search(criteria, {
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
