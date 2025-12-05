import { EmployeeSearchCriteria } from "../dto/EmployeeSearchCriteria";
import { IEmployeeQueryService } from "../IEmployeeQueryService";
import { Role } from "@subdomains/employee/domain/types/Role";
import { CountEmployeesQuery } from "../CountEmployeesQuery";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("CountEmployeesQuery", () => {
  let query: CountEmployeesQuery;
  let mockQueryService: IEmployeeQueryService;

  beforeEach(() => {
    mockQueryService = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByEmployeeCd: vi.fn(),
      search: vi.fn(),
      findAll: vi.fn(),
      count: vi.fn(),
    };

    query = new CountEmployeesQuery(mockQueryService);
  });

  it("全従業員数をカウントできる", async () => {
    vi.mocked(mockQueryService.count).mockResolvedValue(100);

    const result = await query.execute({ criteria: {} });

    expect(result).toBe(100);
    expect(mockQueryService.count).toHaveBeenCalledWith({});
  });

  it("検索条件に一致する従業員数をカウントできる", async () => {
    const criteria: EmployeeSearchCriteria = {
      role: Role.ADMIN,
    };

    vi.mocked(mockQueryService.count).mockResolvedValue(5);

    const result = await query.execute({ criteria });

    expect(result).toBe(5);
    expect(mockQueryService.count).toHaveBeenCalledWith(criteria);
  });

  it("条件に一致する従業員がいない場合は0を返す", async () => {
    const criteria: EmployeeSearchCriteria = {
      name: "存在しない名前",
    };

    vi.mocked(mockQueryService.count).mockResolvedValue(0);

    const result = await query.execute({ criteria });

    expect(result).toBe(0);
  });
});
