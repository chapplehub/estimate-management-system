import { describe, it, expect, vi, beforeEach } from "vitest";
import { DepartmentCdDuplicationCheckDomainService } from "../DepartmentCdDuplicationCheckDomainService";
import { IDepartmentRepository } from "../../repositories/IDepartmentRepository";
import { DepartmentCd } from "../../values/DepartmentCd";
import { Department } from "../../entities/Department";
import { DepartmentName } from "../../values/DepartmentName";
import { Abbreviation } from "../../values/Abbreviation";

describe("DepartmentCdDuplicationCheckDomainService", () => {
  let service: DepartmentCdDuplicationCheckDomainService;
  let mockRepository: IDepartmentRepository;

  beforeEach(() => {
    mockRepository = {
      save: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByDepartmentCd: vi.fn(),
      findChildren: vi.fn(),
      findRootDepartments: vi.fn(),
    };

    service = new DepartmentCdDuplicationCheckDomainService(mockRepository);
  });

  it("部署コードが存在しない場合は false を返す", async () => {
    vi.mocked(mockRepository.findByDepartmentCd).mockResolvedValue(null);

    const result = await service.execute(new DepartmentCd("DEPT001"));

    expect(result).toBe(false);
    expect(mockRepository.findByDepartmentCd).toHaveBeenCalledWith(expect.any(DepartmentCd));
  });

  it("部署コードが既に存在する場合は true を返す", async () => {
    const existingDepartment = Department.create(
      new DepartmentCd("DEPT001"),
      new DepartmentName("営業部"),
      new Abbreviation("営業")
    );
    vi.mocked(mockRepository.findByDepartmentCd).mockResolvedValue(existingDepartment);

    const result = await service.execute(new DepartmentCd("DEPT001"));

    expect(result).toBe(true);
  });
});
