import { Employee } from "@/domain/entities/Employee";
import { EmployeeDTO } from "@/domain/queries/dto/EmployeeDTO";
import {
  EmployeeSearchCriteria,
  ListOptions,
} from "@/domain/queries/dto/EmployeeSearchCriteria";
import { IEmployeeQueryService } from "@/domain/queries/IEmployeeQueryService";
import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@/domain/services/Employee/EmployeeCdDuplicationCheckDomainService";
import { Role } from "@/domain/types/Role";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";
import { EmployeeApplicationService } from "@/application/EmployeeApplicationService";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("EmployeeApplicationService - Query Methods", () => {
  let service: EmployeeApplicationService;
  let mockRepository: IEmployeeRepository;
  let mockQueryService: IEmployeeQueryService;
  let mockDuplicationCheckService: EmployeeCdDuplicationCheckDomainService;

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
    // モックオブジェクトを作成
    mockRepository = {
      save: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByEmployeeCd: vi.fn(),
      findByEmail: vi.fn(),
    };

    mockQueryService = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByEmployeeCd: vi.fn(),
      search: vi.fn(),
      findAll: vi.fn(),
      count: vi.fn(),
    };

    mockDuplicationCheckService = {
      execute: vi.fn(),
    } as unknown as EmployeeCdDuplicationCheckDomainService;

    service = new EmployeeApplicationService(
      mockRepository,
      mockQueryService,
      mockDuplicationCheckService
    );
  });

  describe("getById", () => {
    it("IDで従業員を取得できる", async () => {
      // モックの設定
      vi.mocked(mockQueryService.findById).mockResolvedValue(mockEmployeeDTO);

      // 実行
      const result = await service.getById("test-id-001");

      // 検証
      expect(result).toEqual(mockEmployeeDTO);
      expect(mockQueryService.findById).toHaveBeenCalledWith("test-id-001");
      expect(mockQueryService.findById).toHaveBeenCalledTimes(1);
    });

    it("存在しないIDの場合nullを返す", async () => {
      vi.mocked(mockQueryService.findById).mockResolvedValue(null);

      const result = await service.getById("non-existent-id");

      expect(result).toBeNull();
      expect(mockQueryService.findById).toHaveBeenCalledWith("non-existent-id");
    });
  });

  describe("getByEmail", () => {
    it("メールアドレスで従業員を取得できる", async () => {
      vi.mocked(mockQueryService.findByEmail).mockResolvedValue(
        mockEmployeeDTO
      );

      const result = await service.getByEmail("test@example.com");

      expect(result).toEqual(mockEmployeeDTO);
      expect(mockQueryService.findByEmail).toHaveBeenCalledWith(
        "test@example.com"
      );
    });

    it("存在しないメールアドレスの場合nullを返す", async () => {
      vi.mocked(mockQueryService.findByEmail).mockResolvedValue(null);

      const result = await service.getByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });
  });

  describe("getByEmployeeCd", () => {
    it("従業員CDで従業員を取得できる", async () => {
      vi.mocked(mockQueryService.findByEmployeeCd).mockResolvedValue(
        mockEmployeeDTO
      );

      const result = await service.getByEmployeeCd("EMP000001");

      expect(result).toEqual(mockEmployeeDTO);
      expect(mockQueryService.findByEmployeeCd).toHaveBeenCalledWith(
        "EMP000001"
      );
    });

    it("存在しない従業員CDの場合nullを返す", async () => {
      vi.mocked(mockQueryService.findByEmployeeCd).mockResolvedValue(null);

      const result = await service.getByEmployeeCd("EMP999999");

      expect(result).toBeNull();
    });
  });

  describe("getAll", () => {
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

      const result = await service.getAll();

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

      await service.getAll(options);

      expect(mockQueryService.findAll).toHaveBeenCalledWith(options);
    });
  });

  describe("search", () => {
    it("検索条件で従業員を検索できる", async () => {
      const criteria: EmployeeSearchCriteria = {
        name: "テスト",
        role: Role.USER,
      };

      const mockResults: EmployeeDTO[] = [mockEmployeeDTO];

      vi.mocked(mockQueryService.search).mockResolvedValue(mockResults);

      const result = await service.search(criteria);

      expect(result).toEqual(mockResults);
      expect(mockQueryService.search).toHaveBeenCalledWith(
        criteria,
        undefined
      );
    });

    it("検索条件とオプションを指定して検索できる", async () => {
      const criteria: EmployeeSearchCriteria = {
        role: Role.ADMIN,
        isLocked: false,
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

      const result = await service.search(criteria, options);

      expect(result).toEqual(mockResults);
      expect(mockQueryService.search).toHaveBeenCalledWith(criteria, options);
    });

    it("条件に一致する従業員がいない場合は空配列を返す", async () => {
      const criteria: EmployeeSearchCriteria = {
        name: "存在しない名前",
      };

      vi.mocked(mockQueryService.search).mockResolvedValue([]);

      const result = await service.search(criteria);

      expect(result).toEqual([]);
    });

    it("複数の検索条件を組み合わせて検索できる", async () => {
      const criteria: EmployeeSearchCriteria = {
        name: "テスト",
        email: "test",
        role: Role.USER,
        isLocked: false,
      };

      vi.mocked(mockQueryService.search).mockResolvedValue([mockEmployeeDTO]);

      await service.search(criteria);

      expect(mockQueryService.search).toHaveBeenCalledWith(
        criteria,
        undefined
      );
    });
  });

  describe("count", () => {
    it("全従業員数をカウントできる", async () => {
      vi.mocked(mockQueryService.count).mockResolvedValue(100);

      const result = await service.count({});

      expect(result).toBe(100);
      expect(mockQueryService.count).toHaveBeenCalledWith({});
    });

    it("検索条件に一致する従業員数をカウントできる", async () => {
      const criteria: EmployeeSearchCriteria = {
        role: Role.ADMIN,
      };

      vi.mocked(mockQueryService.count).mockResolvedValue(5);

      const result = await service.count(criteria);

      expect(result).toBe(5);
      expect(mockQueryService.count).toHaveBeenCalledWith(criteria);
    });

    it("条件に一致する従業員がいない場合は0を返す", async () => {
      const criteria: EmployeeSearchCriteria = {
        name: "存在しない名前",
      };

      vi.mocked(mockQueryService.count).mockResolvedValue(0);

      const result = await service.count(criteria);

      expect(result).toBe(0);
    });
  });
});
