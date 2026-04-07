import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";

/**
 * 得意先リポジトリインターフェース
 *
 * 検索・一覧取得については CustomerQueryService を使用すること
 */
export interface CustomerRepository {
  /**
   * 得意先を保存（新規作成・更新）
   */
  save(customer: Customer): Promise<Customer>;

  /**
   * 得意先を削除
   */
  delete(id: CustomerId): Promise<void>;

  /**
   * IDで得意先を取得
   */
  findById(id: CustomerId): Promise<Customer | null>;

  /**
   * 取引先コードで得意先を取得（重複チェック等で使用）
   */
  findByCode(code: CompanyCode): Promise<Customer | null>;
}
