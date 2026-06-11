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
   * 得意先を新規作成
   */
  insert(customer: Customer): Promise<Customer>;

  /**
   * 既存得意先を更新（楽観ロック / ADR-0039）
   *
   * @param expectedVersion 編集画面表示時に取得した version（フォーム往復で持ち回るトークン）。
   *   保存時点の version と一致しない場合は ConflictError を throw し、後勝ちの変更喪失を防ぐ。
   */
  update(customer: Customer, expectedVersion: number): Promise<Customer>;

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
