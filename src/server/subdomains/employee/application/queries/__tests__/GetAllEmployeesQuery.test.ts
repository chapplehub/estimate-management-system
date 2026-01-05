import { EmployeeDTO } from "../dto/EmployeeDTO";
import { ListOptions } from "../dto/EmployeeSearchCriteria";
import { IEmployeeQueryService } from "../IEmployeeQueryService";
import { GetAllEmployeesQuery } from "../GetAllEmployeesQuery";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ROLES } from "@server/shared/auth/types";

describe("GetAllEmployeesQuery", () => {
  let query: GetAllEmployeesQuery;
  let mockQueryService: IEmployeeQueryService;

  const mockEmployeeDTO: EmployeeDTO = {
    id: "test-id-001",
    employeeCd: "EMP000001",
    email: "test@example.com",
    name: "テスト太郎",
    role: USER_ROLES.USER,
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

    query = new GetAllEmployeesQuery(mockQueryService);
  });

  it("全従業員を取得できる", async () => {
    const mockEmployees: EmployeeDTO[] = [
      mockEmployeeDTO,
      {
        ...mockEmployeeDTO,
        id: "test-id-002",
        employeeCd: "EMP000002",
        name: "テスト花子",
      },
    ];

    vi.mocked(mockQueryService.findAll).mockResolvedValue(mockEmployees);

    const result = await query.execute({});

    expect(result).toEqual(mockEmployees);
    expect(result.length).toBe(2);
    expect(mockQueryService.findAll).toHaveBeenCalledWith(undefined);
  });

  it("オプションを指定して取得できる", async () => {
    const options: ListOptions = {
      limit: 10,
      offset: 0,
      orderBy: { field: "name", direction: "asc" },
    };

    vi.mocked(mockQueryService.findAll).mockResolvedValue([mockEmployeeDTO]);

    await query.execute({ options });

    expect(mockQueryService.findAll).toHaveBeenCalledWith(options);
  });
});
