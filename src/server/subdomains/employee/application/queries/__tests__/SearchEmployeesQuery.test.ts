import { EmployeeDTO } from "../dto/EmployeeDTO";
import {
  EmployeeSearchCriteria,
  ListOptions,
} from "../dto/EmployeeSearchCriteria";
import { IEmployeeQueryService } from "../IEmployeeQueryService";
import { Role } from "@subdomains/employee/domain/types/Role";
import { SearchEmployeesQuery } from "../SearchEmployeesQuery";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("SearchEmployeesQuery", () => {
  let query: SearchEmployeesQuery;
  let mockQueryService: IEmployeeQueryService;

  const mockEmployeeDTO: EmployeeDTO = {
    id: "test-id-001",
    employeeCd: "EMP000001",
    email: "test@example.com",
    name: "テスト太郎",
    role: Role.USER,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  };

  beforeEach(() => {
    mockQueryService = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByEmployeeCd: vi.fn(),
      search: vi.fn(),
      findAll: vi.fn(),
      count: vi.fn(),
    };

    query = new SearchEmployeesQuery(mockQueryService);
  });

  it("検索条件で従業員を検索できる", async () => {
    const criteria: EmployeeSearchCriteria = {
      name: "テスト",
      role: Role.USER,
    };

    const mockResults: EmployeeDTO[] = [mockEmployeeDTO];

    vi.mocked(mockQueryService.search).mockResolvedValue(mockResults);

    const result = await query.execute({ criteria });

    expect(result).toEqual(mockResults);
    expect(mockQueryService.search).toHaveBeenCalledWith(criteria, undefined);
  });

  it("検索条件とオプションを指定して検索できる", async () => {
    const criteria: EmployeeSearchCriteria = {
      role: Role.ADMIN,
    };

    const options: ListOptions = {
      limit: 20,
      offset: 10,
      orderBy: { field: "createdAt", direction: "desc" },
    };

    const mockResults: EmployeeDTO[] = [
      { ...mockEmployeeDTO, role: Role.ADMIN },
    ];

    vi.mocked(mockQueryService.search).mockResolvedValue(mockResults);

    const result = await query.execute({ criteria, options });

    expect(result).toEqual(mockResults);
    expect(mockQueryService.search).toHaveBeenCalledWith(criteria, options);
  });

  it("条件に一致する従業員がいない場合は空配列を返す", async () => {
    const criteria: EmployeeSearchCriteria = {
      name: "存在しない名前",
    };

    vi.mocked(mockQueryService.search).mockResolvedValue([]);

    const result = await query.execute({ criteria });

    expect(result).toEqual([]);
  });

  it("複数の検索条件を組み合わせて検索できる", async () => {
    const criteria: EmployeeSearchCriteria = {
      name: "テスト",
      email: "test",
      role: Role.USER,
    };

    vi.mocked(mockQueryService.search).mockResolvedValue([mockEmployeeDTO]);

    await query.execute({ criteria });

    expect(mockQueryService.search).toHaveBeenCalledWith(criteria, undefined);
  });
});
