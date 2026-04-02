import { EmployeeDTO } from "./dto/EmployeeDTO";
import { EmployeeSearchCriteria, ListOptions } from "./dto/EmployeeSearchCriteria";

/**
 * 従業員クエリサービスインターフェース
 *
 * 読み取り専用の検索・取得機能を提供
 * 複雑な検索条件にも対応でき、軽量なDTOで結果を返す
 *
 * リポジトリとの違い：
 * - リポジトリ：Entity の永続化・取得（完全な Entity の再構築）
 * - QueryService：検索・一覧取得（軽量な DTO で返却）
 */
export interface EmployeeQueryService {
  /**
   * IDで従業員を取得
   * @param id 従業員ID
   * @returns 従業員DTO（存在しない場合null）
   */
  findById(id: string): Promise<EmployeeDTO | null>;

  /**
   * 従業員CDで従業員を取得
   * @param employeeCd 従業員CD
   * @returns 従業員DTO（存在しない場合null）
   */
  findByEmployeeCd(employeeCd: string): Promise<EmployeeDTO | null>;

  /**
   * 検索条件に基づいて従業員を検索
   * @param criteria 検索条件
   * @param options リスト取得オプション（ページネーション、ソート等）
   * @returns 従業員DTOの配列
   */
  search(criteria: EmployeeSearchCriteria, options?: ListOptions): Promise<EmployeeDTO[]>;
}
