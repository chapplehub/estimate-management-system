import { FiscalYear } from "@server/shared/domain/values/FiscalYear";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateNumberIssuer } from "@subdomains/estimate/domain/repositories/EstimateNumberIssuer";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { EstimateDuplicationService } from "@subdomains/estimate/domain/services/EstimateDuplicationService";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";

/**
 * 見積複製コマンドの入力（すべてプリミティブ型）。
 *
 * 複製の選択（複製元 ID・選択バリエーション ID 群、順序保持）に加え、複製時に更新される
 * 周辺コンテキスト（見積年月日・締切・税率・作成者・部署）を画面から渡す。見積区分・提出区分・
 * 得意先・納品先・税端数区分は複製元から継承するため入力に含めない（§5.3）。
 */
export type DuplicateEstimateInput = {
  sourceEstimateId: string;
  /** 複製するバリエーション ID（選択順を保持し、複製先で連番に振り直す）。 */
  selectedVariationIds: string[];
  estimateDate: Date;
  deadline: Date;
  taxRate: number;
  createdBy: string;
  departmentId: string;
};

/**
 * 見積複製コマンド（C6・集約またぎの縦スライス）。
 *
 * 流れ: 複製元ロード（読み取りのみ）→ 複製元と同種別で保存時採番（§2.3）→ 複製ドメインサービスで
 * 複製集約と系譜を生成 → insertWithCopies で新見積と系譜をアトミック保存（ADR-0040）。
 * 採番は複製集約の生成に確定済み見積番号が必要なため save 前に行う。年度は estimateDate から導出。
 * 複製元は一切変更しない。複製は読み取り、生成は新集約側。
 */
export class DuplicateEstimateCommand {
  constructor(
    private readonly estimateRepository: EstimateRepository,
    private readonly numberIssuer: EstimateNumberIssuer
  ) {}

  async execute(input: DuplicateEstimateInput): Promise<Estimate> {
    // 1. 複製元をロード（不在は NotFoundEntityError）。複製元は以降変更しない。
    const source = await this.estimateRepository.findById(new EstimateId(input.sourceEstimateId));
    if (!source) {
      throw new NotFoundEntityError(Estimate, { id: input.sourceEstimateId });
    }

    // 2. 複製元と同じ見積種別で新採番（§2.3 保存時採番）。年度は複製時の estimateDate から導出。
    const fiscalYear = FiscalYear.from(input.estimateDate);
    const estimateNumber = await this.numberIssuer.issueNext(fiscalYear, source.estimateType);

    // 3. 複製ドメインサービスで複製集約と系譜を生成（プリミティブ → 値オブジェクト変換）。
    const { estimate, copies } = EstimateDuplicationService.duplicate({
      source,
      selectedVariationIds: input.selectedVariationIds.map((id) => new EstimateVariationId(id)),
      estimateNumber,
      estimateDate: input.estimateDate,
      deadline: input.deadline,
      taxRate: new TaxRate(input.taxRate),
      createdBy: new EmployeeId(input.createdBy),
      departmentId: new DepartmentId(input.departmentId),
    });

    // 4. 新見積と系譜をアトミックに永続化（採番衝突は ConflictError が infrastructure 層から bubble する）。
    return await this.estimateRepository.insertWithCopies(estimate, copies);
  }
}
