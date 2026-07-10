import { FiscalYear } from "@server/shared/domain/values/FiscalYear";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateNumberIssuer } from "@subdomains/estimate/domain/repositories/EstimateNumberIssuer";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import {
  EstimateDuplicationService,
  duplicatedUnitPriceKey,
  type DuplicatedUnitPriceMap,
} from "@subdomains/estimate/domain/services/EstimateDuplicationService";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { toSellingPriceTarget, type SellingPriceResolver } from "../shared/resolveLinePrices";
import {
  resolveUnitPricesOrReject,
  type UnitPriceResolutionRequest,
} from "../shared/resolveUnitPricesOrReject";

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
    private readonly numberIssuer: EstimateNumberIssuer,
    /**
     * 複製先明細の見積単価を権威解決する価格決定（#428・#431）。複製元の単価は引き継がず、
     * 複製先の条件（複製先の見積年月日・複製元の宛先・各バリの提出区分）で解決し直す。
     */
    private readonly resolveSellingPrice: SellingPriceResolver
  ) {}

  async execute(input: DuplicateEstimateInput): Promise<Estimate> {
    // 1. 複製元をロード（不在は NotFoundEntityError）。複製元は以降変更しない。
    const source = await this.estimateRepository.findById(new EstimateId(input.sourceEstimateId));
    if (!source) {
      throw new NotFoundEntityError(Estimate, { id: input.sourceEstimateId });
    }

    const selectedVariationIds = input.selectedVariationIds.map(
      (id) => new EstimateVariationId(id)
    );

    // 2. 複製先明細の見積単価を価格決定で一括解決する（#431）。複製先の見積年月日・複製元の宛先・
    //    各バリの提出区分で解決し、1明細でも解決不能なら書き込み前に商品名を列挙して拒否する
    //    （解決はドメインに触れる前に完了するため暫定値・0円明細を作らない）。
    const resolvedUnitPrices = await this.resolveSelectedVariationPrices(
      source,
      selectedVariationIds,
      input.estimateDate
    );

    // 3. 複製ドメインサービスで複製集約と系譜を生成（プリミティブ → 値オブジェクト変換）。
    const fiscalYear = FiscalYear.from(input.estimateDate);
    const estimateNumber = await this.numberIssuer.issueNext(fiscalYear, source.estimateType);
    const { estimate, copies } = EstimateDuplicationService.duplicate({
      source,
      selectedVariationIds,
      estimateNumber,
      estimateDate: input.estimateDate,
      deadline: input.deadline,
      taxRate: new TaxRate(input.taxRate),
      createdBy: new EmployeeId(input.createdBy),
      departmentId: new DepartmentId(input.departmentId),
      resolvedUnitPrices,
    });

    // 4. 新見積と系譜をアトミックに永続化（採番衝突は ConflictError が infrastructure 層から bubble する）。
    return await this.estimateRepository.insertWithCopies(estimate, copies);
  }

  /**
   * 選択バリエーションの全明細（セット構成明細含む）の見積単価を、複製先条件で一括解決する。
   * キーは提出区分×商品ID（{@link duplicatedUnitPriceKey}）で、ドメインの参照キーと一致させる。
   */
  private async resolveSelectedVariationPrices(
    source: Estimate,
    selectedVariationIds: EstimateVariationId[],
    estimateDate: Date
  ): Promise<DuplicatedUnitPriceMap> {
    const requests: UnitPriceResolutionRequest[] = [];
    for (const variationId of selectedVariationIds) {
      const variation = source.variations.find((v) => v.id.equals(variationId));
      if (!variation) {
        // 存在しないバリエーション id はドメインの resolveVariation が列挙時に拒否するが、
        // 価格解決段でも安全側に無視する（不正 id で解決対象を膨らませない）。
        continue;
      }
      for (const item of variation.items) {
        requests.push({
          key: duplicatedUnitPriceKey(variation.submissionType, item.productId.value),
          productName: item.itemName.value,
          target: toSellingPriceTarget(item.productId.value, {
            submissionType: variation.submissionType,
            customerId: source.customerId.value,
            deliveryLocationId: source.deliveryLocationId.value,
            estimateDate,
          }),
        });
      }
    }
    return resolveUnitPricesOrReject(requests, this.resolveSellingPrice);
  }
}
