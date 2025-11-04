import { EmployeeDTO } from "@/domain/queries/dto/EmployeeDTO";
import { IEmployeeQueryService } from "@/domain/queries/IEmployeeQueryService";
import { Role } from "@/domain/types/Role";
import { GetEmployeeByEmployeeCdQuery } from "@/application/Employee/queries/GetEmployeeByEmployeeCdQuery";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GetEmployeeByEmployeeCdQuery", () => {
  let query: GetEmployeeByEmployeeCdQuery;
  let mockQueryService: IEmployeeQueryService;

  const mockEmployeeDTO: EmployeeDTO = {
    id: "test-id-001",
    employeeCd: "EMP000001",
    email: "test@example.com",
    name: "テスト太郎",
    role: Role.USER,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
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

    query = new GetEmployeeByEmployeeCdQuery(mockQueryService);
  });

  it("従業員CDで従業員を取得できる", async () => {
    vi.mocked(mockQueryService.findByEmployeeCd).mockResolvedValue(
      mockEmployeeDTO
    );

    const result = await query.execute({ employeeCd: "EMP000001" });

    expect(result).toEqual(mockEmployeeDTO);
    expect(mockQueryService.findByEmployeeCd).toHaveBeenCalledWith(
      "EMP000001"
    );
  });

  it("存在しない従業員CDの場合nullを返す", async () => {
    vi.mocked(mockQueryService.findByEmployeeCd).mockResolvedValue(null);

    const result = await query.execute({ employeeCd: "EMP999999" });

    expect(result).toBeNull();
  });
});
