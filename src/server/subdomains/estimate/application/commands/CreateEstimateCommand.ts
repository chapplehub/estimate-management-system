import { FiscalYear } from "@server/shared/domain/values/FiscalYear";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import {
  Estimate,
  EstimateFactory,
  type AfterRepairDetailDescriptor,
  type EstimateItemDescriptor,
  type EstimateSetGroupDescriptor,
  type EstimateVariationDescriptor,
  type RepairDetailDescriptor,
} from "@subdomains/estimate/domain/entities";
import { EstimateNumberIssuer } from "@subdomains/estimate/domain/repositories/EstimateNumberIssuer";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { ProductQueryService } from "@subdomains/product/application/queries/ProductQueryService";
import { assertSetComponentsValid } from "../shared/assertSetComponentsValid";
import { EmergencyReason } from "@subdomains/estimate/domain/values/approval/EmergencyReason";
import { EstimateType } from "@subdomains/estimate/domain/values/EstimateType";
import { FaultDescription } from "@subdomains/estimate/domain/values/FaultDescription";
import { ItemName } from "@subdomains/estimate/domain/values/ItemName";
import { Memo } from "@subdomains/estimate/domain/values/Memo";
import { Money } from "@subdomains/estimate/domain/values/Money";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { TaxRoundingType } from "@subdomains/estimate/domain/values/TaxRoundingType";
import { Unit } from "@subdomains/estimate/domain/values/Unit";
import { DiscountRate } from "@subdomains/estimate/domain/values/DiscountRate";

/** 明細の入力（プリミティブ。金額は major units = 円）。 */
export type CreateEstimateItemInput = {
  productId: string;
  sortOrder: number;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate?: number;
  itemDiscount?: number;
  customerMemo?: string | null;
  internalMemo?: string | null;
  /** 得意先改訂で生まれた明細のみ持つ納品価格（円）。指定時のみ改訂明細詳細を構築する。 */
  revisedDeliveryPrice?: number | null;
};

/**
 * セット群の入力（プリミティブ。ADR-0047）。構成明細を入れ子の `components` で持つ。
 * C1 は app/factory/domain 層まで配線（seed/テストでセット付き見積を生成可能）。create 画面 UI は #351。
 */
export type CreateEstimateSetGroupInput = {
  productId: string;
  itemName: string;
  unit: string;
  components: CreateEstimateItemInput[];
  customerMemo?: string | null;
  internalMemo?: string | null;
};

/** バリエーションの入力（プリミティブ）。 */
export type CreateEstimateVariationInput = {
  variationNumber: number;
  /** 提出区分（"CUSTOMER" / "DELIVERY_LOCATION"）。バリエーション単位の不変属性（ADR-0045） */
  submissionType: string;
  /** 通常明細（非セット）。構成明細は setGroups の入れ子側に持つ。 */
  items: CreateEstimateItemInput[];
  /** セット群（ADR-0047）。省略時は空。 */
  setGroups?: CreateEstimateSetGroupInput[];
  overallDiscount?: number;
  customerMemo?: string | null;
  internalMemo?: string | null;
};

/** 修理見積（事前）サブタイプ詳細の入力。 */
export type CreateRepairDetailInput = {
  targetProductId: string;
  faultDescription: string;
  scheduledRepairDate: Date;
};

/** 事後修理見積サブタイプ詳細の入力。 */
export type CreateAfterRepairDetailInput = {
  targetProductId: string;
  faultDescription: string;
  actualRepairDate: Date;
  emergencyReason: string;
};

/**
 * 見積作成コマンドの入力（すべてプリミティブ型）。
 *
 * 税率（taxRate）・部署（departmentId）・作成者（createdBy）は見積作成画面から渡す。
 * 税率の自動設定（§A.1）/ 部署の自動解決はポート化を含め後続 issue でスコープ。
 */
export type CreateEstimateInput = {
  estimateType: string;
  estimateDate: Date;
  deadline: Date;
  customerId: string;
  deliveryLocationId: string;
  taxRate: number;
  taxRoundingType: string;
  createdBy: string;
  departmentId: string;
  variations: CreateEstimateVariationInput[];
  repairDetail?: CreateRepairDetailInput | null;
  afterRepairDetail?: CreateAfterRepairDetailInput | null;
};

/**
 * 見積作成コマンド（C1・多階層集約 Estimate の初アプリ層スライス）。
 *
 * 流れ: プリミティブ → 値オブジェクト変換 → 保存時採番（§2.3）→ 集約生成 → 永続化。
 * 採番は `Estimate` 生成に確定済み見積番号が必要なため save 前に行う。保存失敗時に
 * 連番が欠番となることは §2.2（欠番許容・削除番号は再利用しない）が許容する。
 * 子エンティティの組み立ては集約境界規約により EstimateFactory（集約内）へ委譲する。
 */
export class CreateEstimateCommand {
  constructor(
    private readonly estimateRepository: EstimateRepository,
    private readonly numberIssuer: EstimateNumberIssuer,
    /**
     * セット構成のライブ区分・有効性検証（ADR-0052）用の商品クエリ。
     * セット群を含まない既存の作成経路では未使用のため任意注入とし、後方互換を保つ。
     */
    private readonly productQueryService?: ProductQueryService
  ) {}

  async execute(input: CreateEstimateInput): Promise<Estimate> {
    // 1. プリミティブ → 値オブジェクト変換
    const estimateType = EstimateType.from(input.estimateType);
    const taxRate = new TaxRate(input.taxRate);
    const taxRoundingType = TaxRoundingType.from(input.taxRoundingType);

    const variations: EstimateVariationDescriptor[] = input.variations.map((variation) =>
      this.toVariationDescriptor(variation)
    );
    const repairDetail = this.toRepairDescriptor(input.repairDetail);
    const afterRepairDetail = this.toAfterRepairDescriptor(input.afterRepairDetail);

    // 2. 保存時採番（§2.3）。年度は estimateDate から JST・4月始まりで導出する。
    const fiscalYear = FiscalYear.from(input.estimateDate);
    const estimateNumber = await this.numberIssuer.issueNext(fiscalYear, estimateType);

    // 3. 集約生成（空見積不可・サブタイプ整合・variationNumber 重複は集約が担保）
    const estimate = EstimateFactory.create({
      estimateNumber,
      estimateDate: input.estimateDate,
      deadline: input.deadline,
      customerId: new CustomerId(input.customerId),
      deliveryLocationId: new DeliveryLocationId(input.deliveryLocationId),
      taxRate,
      taxRoundingType,
      createdBy: new EmployeeId(input.createdBy),
      departmentId: new DepartmentId(input.departmentId),
      variations,
      repairDetail,
      afterRepairDetail,
    });

    // 3.5 セット構成のライブ区分・有効性検証（ADR-0052・ペイロード防御）。
    // 商品クエリが注入されている場合のみ実行（セット群を含まない既存経路は後方互換でスキップ）。
    if (this.productQueryService) {
      for (const variation of estimate.variations) {
        await assertSetComponentsValid(variation, this.productQueryService);
      }
    }

    // 4. 永続化（採番衝突時は ConflictError が infrastructure 層から bubble する）
    return await this.estimateRepository.insert(estimate);
  }

  private toVariationDescriptor(
    variation: CreateEstimateVariationInput
  ): EstimateVariationDescriptor {
    return {
      variationNumber: variation.variationNumber,
      submissionType: SubmissionType.from(variation.submissionType),
      items: variation.items.map((item) => this.toItemDescriptor(item)),
      setGroups: variation.setGroups?.map((group) => this.toSetGroupDescriptor(group)),
      overallDiscount:
        variation.overallDiscount != null
          ? Money.fromMajorUnits(variation.overallDiscount)
          : undefined,
      customerMemo:
        variation.customerMemo != null ? Memo.create(variation.customerMemo) : undefined,
      internalMemo:
        variation.internalMemo != null ? Memo.create(variation.internalMemo) : undefined,
    };
  }

  private toSetGroupDescriptor(group: CreateEstimateSetGroupInput): EstimateSetGroupDescriptor {
    return {
      productId: new ProductId(group.productId),
      itemName: new ItemName(group.itemName),
      unit: new Unit(group.unit),
      components: group.components.map((item) => this.toItemDescriptor(item)),
      customerMemo: group.customerMemo != null ? Memo.create(group.customerMemo) : undefined,
      internalMemo: group.internalMemo != null ? Memo.create(group.internalMemo) : undefined,
    };
  }

  private toItemDescriptor(item: CreateEstimateItemInput): EstimateItemDescriptor {
    return {
      productId: new ProductId(item.productId),
      sortOrder: item.sortOrder,
      itemName: new ItemName(item.itemName),
      quantity: new Quantity(item.quantity),
      unit: new Unit(item.unit),
      unitPrice: Money.fromMajorUnits(item.unitPrice),
      discountRate: item.discountRate != null ? new DiscountRate(item.discountRate) : undefined,
      itemDiscount: item.itemDiscount != null ? Money.fromMajorUnits(item.itemDiscount) : undefined,
      customerMemo: item.customerMemo != null ? Memo.create(item.customerMemo) : undefined,
      internalMemo: item.internalMemo != null ? Memo.create(item.internalMemo) : undefined,
      revisedDeliveryPrice:
        item.revisedDeliveryPrice != null ? Money.fromMajorUnits(item.revisedDeliveryPrice) : null,
    };
  }

  private toRepairDescriptor(
    detail: CreateRepairDetailInput | null | undefined
  ): RepairDetailDescriptor | null {
    if (!detail) {
      return null;
    }
    return {
      targetProductId: new ProductId(detail.targetProductId),
      faultDescription: new FaultDescription(detail.faultDescription),
      scheduledRepairDate: detail.scheduledRepairDate,
    };
  }

  private toAfterRepairDescriptor(
    detail: CreateAfterRepairDetailInput | null | undefined
  ): AfterRepairDetailDescriptor | null {
    if (!detail) {
      return null;
    }
    return {
      targetProductId: new ProductId(detail.targetProductId),
      faultDescription: new FaultDescription(detail.faultDescription),
      actualRepairDate: detail.actualRepairDate,
      emergencyReason: new EmergencyReason(detail.emergencyReason),
    };
  }
}
