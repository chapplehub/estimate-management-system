import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { MailAddress } from "@server/shared/domain/values/MailAddress";

/**
 * 従業員リポジトリインターフェース
 *
 * 永続化層の抽象化を提供
 * リポジトリは Entity の永続化と、ID による取得のみを責務とする
 *
 * 検索・一覧取得については EmployeeQueryService を使用すること
 */
export interface EmployeeRepository {
  /**
   * 従業員を新規作成
   */
  insert(employee: Employee): Promise<Employee>;

  /**
   * 既存従業員を更新（楽観ロック / ADR-0039）
   *
   * @param expectedVersion 編集画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   保存時点の version と一致しない場合は ConflictError を throw し、後勝ちの変更喪失を防ぐ。
   */
  update(employee: Employee, expectedVersion: number): Promise<Employee>;

  /**
   * 従業員を削除
   */
  delete(id: EmployeeId): Promise<void>;

  /**
   * IDで従業員を取得（Entity の完全な再構築が必要な場合に使用）
   * 単なる表示目的の場合は EmployeeQueryService を使用すること
   */
  findById(id: EmployeeId): Promise<Employee | null>;

  /**
   * 従業員CDで従業員を取得（重複チェック等で Entity が必要な場合に使用）
   */
  findByEmployeeCd(employeeCd: EmployeeCd): Promise<Employee | null>;

  /**
   * メールアドレスで従業員を取得（重複チェック等で Entity が必要な場合に使用）
   */
  findByEmail(email: MailAddress): Promise<Employee | null>;
}
