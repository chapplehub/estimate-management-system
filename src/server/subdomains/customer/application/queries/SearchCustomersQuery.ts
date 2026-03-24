import { PaginatedResult, PaginationOptions } from "@server/shared/queries/PaginatedResult";

import { CustomerQueryService } from "./CustomerQueryService";
import { CustomerDTO } from "./dto/CustomerDTO";
import { CustomerSearchCriteria, CustomerListOptions } from "./dto/CustomerSearchCriteria";

export type SearchCustomersPaginatedInput = {
  criteria: CustomerSearchCriteria;
  pagination: PaginationOptions;
  orderBy?: CustomerListOptions["orderBy"];
};

export class SearchCustomersQuery {
  constructor(private readonly customerQueryService: CustomerQueryService) {}

  async execute(
    criteria: CustomerSearchCriteria,
    options?: CustomerListOptions
  ): Promise<CustomerDTO[]> {
    return await this.customerQueryService.search(criteria, options);
  }

  /**
   * ページネーション付きで検索を実行
   */
  async executeWithPagination(
    input: SearchCustomersPaginatedInput
  ): Promise<PaginatedResult<CustomerDTO>> {
    const { criteria, pagination, orderBy } = input;
    const { page, pageSize } = pagination;

    // 総件数を取得
    const totalCount = await this.customerQueryService.count(criteria);

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
    const items = await this.customerQueryService.search(criteria, {
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
