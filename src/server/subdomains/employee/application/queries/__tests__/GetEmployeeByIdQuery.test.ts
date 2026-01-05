import { EmployeeDTO } from "../dto/EmployeeDTO";
import { IEmployeeQueryService } from "../IEmployeeQueryService";
import { GetEmployeeByIdQuery } from "../GetEmployeeByIdQuery";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ROLES } from "@server/shared/auth/types";

describe("GetEmployeeByIdQuery", () => {
  let query: GetEmployeeByIdQuery;
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

    query = new GetEmployeeByIdQuery(mockQueryService);
  });

  it("IDで従業員を取得できる", async () => {
    vi.mocked(mockQueryService.findById).mockResolvedValue(mockEmployeeDTO);

    const result = await query.execute({ id: "test-id-001" });

    expect(result).toEqual(mockEmployeeDTO);
    expect(mockQueryService.findById).toHaveBeenCalledWith("test-id-001");
    expect(mockQueryService.findById).toHaveBeenCalledTimes(1);
  });

  it("存在しないIDの場合nullを返す", async () => {
    vi.mocked(mockQueryService.findById).mockResolvedValue(null);

    const result = await query.execute({ id: "non-existent-id" });

    expect(result).toBeNull();
    expect(mockQueryService.findById).toHaveBeenCalledWith("non-existent-id");
  });
});
