import { randomUUID } from "crypto";
import type {
  CreateAuthUserInput,
  CreateAuthUserResult,
  IUserManagementService,
  RemoveAuthUserResult,
  UpdateAuthUserEmailResult,
  UpdateAuthUserRoleResult,
} from "../IUserManagementService";
import type { AuthUser, UserRole } from "../types";

/**
 * テスト用のFake UserManagementService
 *
 * インメモリでユーザー管理を行い、テスト用のフラグで失敗をシミュレートできる。
 */
export class FakeUserManagementService implements IUserManagementService {
  private users = new Map<string, AuthUser>();
  private usersByEmployeeId = new Map<string, AuthUser>();
  private shouldFailOnCreate = false;

  /**
   * テスト用: 次のcreateUser呼び出しを失敗させる
   */
  setCreateUserToFail(fail: boolean): void {
    this.shouldFailOnCreate = fail;
  }

  async createUser(input: CreateAuthUserInput): Promise<CreateAuthUserResult> {
    if (this.shouldFailOnCreate) {
      return { success: false, error: "Fake error for testing" };
    }

    const userId = randomUUID();
    const now = new Date();

    const user: AuthUser = {
      id: userId,
      email: input.email,
      name: input.name,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      employeeId: input.employeeId,
      role: input.role,
    };

    this.users.set(userId, user);
    this.usersByEmployeeId.set(input.employeeId, user);

    return { success: true, userId };
  }

  async updateUserEmail(
    userId: string,
    newEmail: string
  ): Promise<UpdateAuthUserEmailResult> {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    user.email = newEmail;
    user.updatedAt = new Date();
    return { success: true };
  }

  async removeUser(userId: string): Promise<RemoveAuthUserResult> {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (user.employeeId) {
      this.usersByEmployeeId.delete(user.employeeId);
    }
    this.users.delete(userId);
    return { success: true };
  }

  async findUserByEmployeeId(
    employeeId: string
  ): Promise<{ id: string } | null> {
    const user = this.usersByEmployeeId.get(employeeId);
    return user ? { id: user.id } : null;
  }

  async updateUserRole(
    userId: string,
    role: UserRole
  ): Promise<UpdateAuthUserRoleResult> {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    user.role = role;
    user.updatedAt = new Date();
    return { success: true };
  }

  /**
   * テスト用: 内部状態をリセットする
   */
  reset(): void {
    this.users.clear();
    this.usersByEmployeeId.clear();
    this.shouldFailOnCreate = false;
  }
}
