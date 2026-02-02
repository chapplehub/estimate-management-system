import { DepartmentDTO, DepartmentTreeDTO } from "./dto/DepartmentDTO";
import { DepartmentSearchCriteria, DepartmentListOptions } from "./dto/DepartmentSearchCriteria";

/**
 * 部署クエリサービスインターフェース
 *
 * 読み取り専用の検索・取得機能を提供
 * 複雑な検索条件にも対応でき、軽量なDTOで結果を返す
 *
 * リポジトリとの違い：
 * - リポジトリ：Entity の永続化・取得（完全な Entity の再構築）
 * - QueryService：検索・一覧取得（軽量な DTO で返却）
 */
export interface DepartmentQueryService {
  /**
   * IDで部署を取得
   * @param id 部署ID
   * @returns 部署DTO（存在しない場合null）
   */
  findById(id: string): Promise<DepartmentDTO | null>;

  /**
   * 部署コードで部署を取得
   * @param departmentCd 部署コード
   * @returns 部署DTO（存在しない場合null）
   */
  findByDepartmentCd(departmentCd: string): Promise<DepartmentDTO | null>;

  /**
   * 検索条件に基づいて部署を検索
   * @param criteria 検索条件
   * @param options リスト取得オプション（ページネーション、ソート等）
   * @returns 部署DTOの配列
   */
  search(
    criteria: DepartmentSearchCriteria,
    options?: DepartmentListOptions
  ): Promise<DepartmentDTO[]>;

  /**
   * 全部署を取得
   * @param options リスト取得オプション
   * @returns 部署DTOの配列
   */
  findAll(options?: DepartmentListOptions): Promise<DepartmentDTO[]>;

  /**
   * 有効な部署のみを取得
   * @param options リスト取得オプション
   * @returns 部署DTOの配列
   */
  findActive(options?: DepartmentListOptions): Promise<DepartmentDTO[]>;

  /**
   * 子部署を取得
   * @param parentId 親部署ID
   * @param options リスト取得オプション
   * @returns 部署DTOの配列
   */
  findChildren(parentId: string, options?: DepartmentListOptions): Promise<DepartmentDTO[]>;

  /**
   * ルート部署（親がない部署）を取得
   * @param options リスト取得オプション
   * @returns 部署DTOの配列
   */
  findRootDepartments(options?: DepartmentListOptions): Promise<DepartmentDTO[]>;

  /**
   * 部署ツリーを取得（階層構造）
   * @param rootId ルートとなる部署ID（nullの場合は全ツリー）
   * @returns 階層構造を持つ部署DTOの配列
   */
  getTree(rootId?: string | null): Promise<DepartmentTreeDTO[]>;

  /**
   * 検索条件に一致する部署数をカウント
   * @param criteria 検索条件
   * @returns 部署数
   */
  count(criteria: DepartmentSearchCriteria): Promise<number>;
}
