import { PaginatedResult, PaginationOptions } from "@server/shared/queries/PaginatedResult";

import { DeliveryLocationQueryService } from "./DeliveryLocationQueryService";
import { DeliveryLocationDTO } from "./dto/DeliveryLocationDTO";
import {
  DeliveryLocationSearchCriteria,
  DeliveryLocationListOptions,
} from "./dto/DeliveryLocationSearchCriteria";

export type SearchDeliveryLocationsPaginatedInput = {
  criteria: DeliveryLocationSearchCriteria;
  pagination: PaginationOptions;
  orderBy?: DeliveryLocationListOptions["orderBy"];
};

export class SearchDeliveryLocationsQuery {
  constructor(private readonly deliveryLocationQueryService: DeliveryLocationQueryService) {}

  async execute(
    criteria: DeliveryLocationSearchCriteria,
    options?: DeliveryLocationListOptions
  ): Promise<DeliveryLocationDTO[]> {
    return await this.deliveryLocationQueryService.search(criteria, options);
  }

  /**
   * ページネーション付きで検索を実行
   */
  async executeWithPagination(
    input: SearchDeliveryLocationsPaginatedInput
  ): Promise<PaginatedResult<DeliveryLocationDTO>> {
    const { criteria, pagination, orderBy } = input;
    const { page, pageSize } = pagination;

    // 総件数を取得
    const totalCount = await this.deliveryLocationQueryService.count(criteria);

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
    const items = await this.deliveryLocationQueryService.search(criteria, {
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
