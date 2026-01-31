import { EmployeeDTO } from "../dto/EmployeeDTO";
import { IEmployeeQueryService } from "../IEmployeeQueryService";
import { GetEmployeeByEmailQuery } from "../GetEmployeeByEmailQuery";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ROLES } from "@server/shared/auth/types";

describe("GetEmployeeByEmailQuery", () => {
  let query: GetEmployeeByEmailQuery;
  let mockQueryService: IEmployeeQueryService;

  const mockEmployeeDTO: EmployeeDTO = {
    id: "test-id-001",
    employeeCd: "EMP000001",
    email: "test@example.com",
    name: "テスト太郎",
    departmentId: "dept-001",
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

    query = new GetEmployeeByEmailQuery(mockQueryService);
  });

  it("メールアドレスで従業員を取得できる", async () => {
    vi.mocked(mockQueryService.findByEmail).mockResolvedValue(mockEmployeeDTO);

    const result = await query.execute({ email: "test@example.com" });

    expect(result).toEqual(mockEmployeeDTO);
    expect(mockQueryService.findByEmail).toHaveBeenCalledWith("test@example.com");
  });

  it("存在しないメールアドレスの場合nullを返す", async () => {
    vi.mocked(mockQueryService.findByEmail).mockResolvedValue(null);

    const result = await query.execute({ email: "nonexistent@example.com" });

    expect(result).toBeNull();
  });
});
