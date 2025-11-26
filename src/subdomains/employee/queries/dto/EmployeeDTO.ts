import { Role } from "@/subdomains/employee/types/Role";

/**
 * 従業員データ転送オブジェクト
 * 読み取り専用のデータ表現（軽量）
 */
export type EmployeeDTO = {
  id: string;
  employeeCd: string;
  email: string;
  name: string;
  role: Role;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
