import { Employee } from "@/subdomains/employee/entities/Employee";
import { EmployeeCd } from "@/subdomains/employee/values/EmployeeCd";
import { MailAddress } from "@/shared/domain/values/MailAddress";

/**
 * 従業員リポジトリインターフェース
 *
 * 永続化層の抽象化を提供
 * リポジトリは Entity の永続化と、ID による取得のみを責務とする
 *
 * 検索・一覧取得については IEmployeeQueryService を使用すること
 */
export interface IEmployeeRepository {
  /**
   * 従業員を保存（新規作成・更新）
   */
  save(employee: Employee): Promise<Employee>;

  /**
   * 従業員を削除
   */
  delete(id: string): Promise<void>;

  /**
   * IDで従業員を取得（Entity の完全な再構築が必要な場合に使用）
   * 単なる表示目的の場合は IEmployeeQueryService を使用すること
   */
  findById(id: string): Promise<Employee | null>;

  /**
   * 従業員CDで従業員を取得（重複チェック等で Entity が必要な場合に使用）
   */
  findByEmployeeCd(employeeCd: EmployeeCd): Promise<Employee | null>;

  /**
   * メールアドレスで従業員を取得（重複チェック等で Entity が必要な場合に使用）
   */
  findByEmail(email: MailAddress): Promise<Employee | null>;
}
