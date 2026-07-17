import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import type { DiscountRate } from "../values/DiscountRate";
import { EmergencyReason } from "../values/approval/EmergencyReason";
import { EstimateNumber } from "../values/EstimateNumber";
import { FaultDescription } from "../values/FaultDescription";
import { ItemName } from "../values/ItemName";
import { Memo } from "../values/Memo";
import { Money } from "@server/shared/domain/values/Money";
import { Quantity } from "../values/Quantity";
import { SubmissionType } from "../values/SubmissionType";
import { TaxRate } from "../values/TaxRate";
import { TaxRoundingType } from "../values/TaxRoundingType";
import { Unit } from "../values/Unit";
import { EstimateVariationCopy } from "../values/EstimateVariationCopy";
import { EstimateVariationId } from "../values/EstimateVariationId";
import { AfterRepairEstimateDetail } from "./AfterRepairEstimateDetail";
import { buildVariation, buildVariationChildren } from "./estimateChildBuilders";
import { Estimate } from "./Estimate";
import { EstimateVariation, type TaxContext, type VariationContent } from "./EstimateVariation";
import { RepairEstimateDetail } from "./RepairEstimateDetail";

/**
 * 集約外（アプリ層）から見積集約を生成するためのドメインファクトリ。
 *
 * **配置理由（集約境界規約）**: 子エンティティ（EstimateVariation / EstimateItem /
 * 修理詳細群 / 改訂明細詳細）の構築は集約内からのみ許される（eslint
 * no-restricted-imports）。アプリ層コマンドはこれら子を直接 new できないため、
 * 「子の組み立て」という集約内責務を本ファクトリに閉じ込め、コマンドへは
 * 値オブジェクトで構成した記述子（descriptor）を受け渡す。
 *
 * 入力は値オブジェクト止まりの記述子とする（primitive → VO 変換はアプリ層コマンドが
 * 既存規約どおり担当）。本ファクトリは「VO 記述子 → 子エンティティ → 集約ルート」の
 * 組み立てのみを責務とし、子エンティティ型を一切外部へ露出しない。
 */

/**
 * 全経路（新規生成・複製先・改訂先）に共通する明細記述子の核。
 *
 * **加算拡張の方針（ADR-20260717-w4d）**: 核には全経路で意味を持つフィールドだけを置き、
 * 経路固有のフィールドは各記述子が交差型で「足す」。禁止フィールド（単価再解決経路の固定値引・
 * ADR-20260714-pv8）は核に無いため、`Copied*` の構築サイトで書こうとすると excess property で
 * コンパイルエラーになる。減算（`Omit`）と違い、禁止は「消し忘れ」で復活しない。
 */
export type ItemDescriptorBase = {
  productId: ProductId;
  sortOrder: number;
  itemName: ItemName;
  quantity: Quantity;
  unit: Unit;
  unitPrice: Money;
  discountRate?: DiscountRate;
  customerMemo?: Memo;
  internalMemo?: Memo;
};

/** 新規生成・C3/C4 経路の明細記述子（値オブジェクト止まり。改訂明細詳細は納品価格 VO から本ファクトリが構築）。 */
export type EstimateItemDescriptor = ItemDescriptorBase & {
  /** 固定値引。単価を宛先へ再解決しない経路（担当者が単価を決めた見積）でのみ意味を持つ。 */
  itemDiscount?: Money;
  /** 改訂済み明細の納品価格。指定時のみ改訂明細詳細を構築する（seed が改訂済み見積を直接生成する経路）。 */
  revisedDeliveryPrice?: Money | null;
};

/**
 * 複製先の明細記述子。核そのもの。
 *
 * 固定値引（単価再解決で根拠を失う・ADR-20260714-pv8 / #598）も改訂明細詳細（複製に改訂の出自は無い）も
 * 名前ごと現れない。核の全フィールドが optional 込みで {@link EstimateItemDescriptor} の部分集合のため、
 * 共有ビルダー（`buildItem` / `buildVariationChildren`）へ構造的にそのまま渡せる。
 */
export type CopiedItemDescriptor = ItemDescriptorBase;

/**
 * 改訂先（得意先改訂）の明細記述子。核＋納品価格。
 *
 * `reviseForCustomer` は全明細に改訂元の `finalAmount` を必ずスナップショットする（§8.4）ため、
 * 納品価格は必須・非 null が honest。populate 漏れは本物の不変則違反としてコンパイルエラーになる。
 * 固定値引は核に無いので複製先と同じく型で禁止される。
 */
export type RevisedItemDescriptor = ItemDescriptorBase & {
  revisedDeliveryPrice: Money;
};

/**
 * セット群の記述子（ADR-0047 / Shape ③-a）。構成明細を入れ子の `components` で持つ。
 *
 * **入れ子の理由（会員解決）**: 構成明細は `EstimateItem.create` で初めて id が確定するため、
 * 記述子の段階では「どの構成明細がこの群に属すか」を id では参照できない。群に構成明細を
 * 入れ子で持たせることで、ファクトリが構成を構築 → 生成 id を捕捉 → 群へ配線できる。
 * これは読み取り DTO（`SetGroupDTO.components`）・作業コピー（往復形状 A）と対称。
 *
 * **明細型 `I` による径数化**: 構成明細は通常明細と同型の価格付き末端行（ADR-0047）なので、
 * 経路ごとの明細制約（複製先＝固定値引不可、改訂先＝納品価格必須）は `I` の差し替えだけで
 * 群の内側まで伝播する。群自身は価格を持たない（価格保守対象商品ではない）ため経路差は無い。
 */
export type SetGroupDescriptor<I> = {
  productId: ProductId;
  /** 商品名スナップショット（SET 商品マスタからの複写）。 */
  itemName: ItemName;
  /** 単位スナップショット。 */
  unit: Unit;
  /** 構成明細（入れ子）。空配列は不可（空群禁止は EstimateSetGroup.create が担保）。 */
  components: I[];
  customerMemo?: Memo;
  internalMemo?: Memo;
};

/** 新規生成・C3/C4 経路のセット群記述子。アプリ層の既存 import 名を保つエイリアス。 */
export type EstimateSetGroupDescriptor = SetGroupDescriptor<EstimateItemDescriptor>;

/**
 * 全経路に共通するバリエーション記述子の核（行の中身とメモ）。
 *
 * 核は全経路で意味を持つ 4 フィールドのみ。`variationNumber` / `submissionType` は経路ごとに
 * 有無が割れる（C3/C4 は番号も提出区分も外側、改訂先は提出区分をビルダーが固定）ため核に入れず、
 * 必要な拡張だけが加算する。核に入れると「核なのに一部経路で使えない」嘘が生まれる（#617 の教訓）。
 */
export type VariationDescriptorBase<I> = {
  /** 通常明細（非セット）の記述子。構成明細は setGroups の入れ子側に持つ。 */
  items: I[];
  /** セット群（ADR-0047）。各群が構成明細を入れ子で持つ。省略時は空。 */
  setGroups?: SetGroupDescriptor<I>[];
  customerMemo?: Memo;
  internalMemo?: Memo;
};

/**
 * 番号・提出区分を含まないバリエーション内容の記述子。C3 AddVariation（番号は集約が採番）と
 * C4 UpdateVariation（番号は変更しない）で共用する。
 * 提出区分は不変属性（ADR-0045）のため C4 で指定できず、C3 では番号同様に内容の外側で受け取る。
 * どちらも核に無いので、この型には名前ごと現れない。
 */
export type VariationContentDescriptor = VariationDescriptorBase<EstimateItemDescriptor> & {
  overallDiscount?: Money;
};

/** バリエーションの記述子（値オブジェクト止まり）。内容記述子に番号と提出区分を加算する。 */
export type EstimateVariationDescriptor = VariationContentDescriptor & {
  variationNumber: number;
  /** 提出区分（ADR-0045: バリエーション単位の不変保存属性。記述子ごとに指定する） */
  submissionType: SubmissionType;
};

/** 修理見積（事前）サブタイプ詳細の記述子。 */
export type RepairDetailDescriptor = {
  targetProductId: ProductId;
  faultDescription: FaultDescription;
  scheduledRepairDate: Date;
};

/** 事後修理見積サブタイプ詳細の記述子。 */
export type AfterRepairDetailDescriptor = {
  targetProductId: ProductId;
  faultDescription: FaultDescription;
  actualRepairDate: Date;
  emergencyReason: EmergencyReason;
};

/**
 * 複製で生まれるバリエーションの記述子。複製元バリエーション（出自）を id 参照として添える。
 * C6 DuplicateEstimate で「新バリエーションの生成 id ↔ 複製元 id」の系譜を作るために用いる。
 *
 * 核＋（番号・提出区分・系譜）。全体値引も固定値引も核に無いため、単価を複製先条件へ再解決した
 * 経路に絶対額の値引を持ち込む記述は名前ごと書けない（ADR-20260714-pv8・#598・#603 を型で強制）。
 * 提出区分は複製元バリエーション単位で継承する（ADR-0045）ため記述子が運ぶ。
 */
export type CopiedVariationDescriptor = VariationDescriptorBase<CopiedItemDescriptor> & {
  variationNumber: number;
  submissionType: SubmissionType;
  sourceVariationId: EstimateVariationId;
};

/**
 * 得意先改訂で生まれるバリエーションの記述子（C7・§7.2）。核＋番号。
 *
 * 提出区分は加算しない。「改訂先は常に得意先宛」は `buildRevisedVariation` が CUSTOMER を固定して
 * 表現する不変則であり、記述子に持たせても値はビルダーに無視される死にフィールドになるため
 * （そこが #598 型の取りこぼしの温床）。系譜 `revisedFrom` も同じ理由でビルダーの必須引数側に置く。
 */
export type RevisedVariationDescriptor = VariationDescriptorBase<RevisedItemDescriptor> & {
  variationNumber: number;
};

/** 見積集約生成の入力のうち、バリエーション以外の全フィールド（生成・複製で共通）。 */
export type EstimateFactoryInputBase = {
  estimateNumber: EstimateNumber;
  estimateDate: Date;
  deadline: Date;
  customerId: CustomerId;
  deliveryLocationId: DeliveryLocationId;
  taxRate: TaxRate;
  taxRoundingType: TaxRoundingType;
  createdBy: EmployeeId;
  departmentId: DepartmentId;
  repairDetail?: RepairDetailDescriptor | null;
  afterRepairDetail?: AfterRepairDetailDescriptor | null;
};

/** 見積集約生成の入力（すべて値オブジェクト／記述子で構成）。 */
export type EstimateFactoryInput = EstimateFactoryInputBase & {
  variations: EstimateVariationDescriptor[];
};

/** 見積複製の入力。variations 以外は新規生成と同じで、variations のみ複製先記述子。 */
export type EstimateDuplicateInput = EstimateFactoryInputBase & {
  variations: CopiedVariationDescriptor[];
};

export class EstimateFactory {
  /**
   * VO 記述子から子エンティティを組み立て、集約ルート Estimate を生成する。
   *
   * 空見積不可・variationNumber 重複・estimateType とサブタイプ詳細の整合
   * （ADR-0019）は Estimate.create() が担保するため、本ファクトリは追加検証を行わない。
   */
  static create(input: EstimateFactoryInput): Estimate {
    const tax: TaxContext = {
      taxRate: input.taxRate,
      taxRoundingType: input.taxRoundingType,
    };

    const variations = input.variations.map((variation) => buildVariation(variation, tax));

    return EstimateFactory.assembleEstimate(input, variations);
  }

  /**
   * 複製元から作った系譜付き記述子で複製集約を生成し、系譜（複製先 id ↔ 複製元 id）も返す（C6）。
   *
   * 系譜は新バリエーションの生成 id が確定するこの場でペア化する。系譜は集約に属さない
   * 兄弟成果物として返し、永続化は EstimateRepository.insertWithCopies が担う（ADR-0040）。
   * 単価クリア・連番振り直し・継承項目の選択といった複製の業務判断は呼び出し側
   * （EstimateDuplicationService）が記述子化済みで、本メソッドは構築とペア化のみを担う。
   */
  static duplicate(input: EstimateDuplicateInput): {
    estimate: Estimate;
    copies: EstimateVariationCopy[];
  } {
    const tax: TaxContext = {
      taxRate: input.taxRate,
      taxRoundingType: input.taxRoundingType,
    };

    const built = input.variations.map((variation) => ({
      variation: buildVariation(variation, tax),
      sourceVariationId: variation.sourceVariationId,
    }));

    const estimate = EstimateFactory.assembleEstimate(
      input,
      built.map((b) => b.variation)
    );

    const copies = built.map((b) =>
      EstimateVariationCopy.create(b.variation.id, b.sourceVariationId)
    );

    return { estimate, copies };
  }

  /** 構築済みの子バリエーションと記述子から集約ルートを組み立てる（create / duplicate 共通）。 */
  private static assembleEstimate(
    input: EstimateFactoryInputBase,
    variations: EstimateVariation[]
  ): Estimate {
    return Estimate.create({
      estimateNumber: input.estimateNumber,
      estimateDate: input.estimateDate,
      deadline: input.deadline,
      customerId: input.customerId,
      deliveryLocationId: input.deliveryLocationId,
      taxRate: input.taxRate,
      taxRoundingType: input.taxRoundingType,
      createdBy: input.createdBy,
      departmentId: input.departmentId,
      variations,
      repairDetail: input.repairDetail
        ? RepairEstimateDetail.create({
            targetProductId: input.repairDetail.targetProductId,
            faultDescription: input.repairDetail.faultDescription,
            scheduledRepairDate: input.repairDetail.scheduledRepairDate,
          })
        : null,
      afterRepairDetail: input.afterRepairDetail
        ? AfterRepairEstimateDetail.create({
            targetProductId: input.afterRepairDetail.targetProductId,
            faultDescription: input.afterRepairDetail.faultDescription,
            actualRepairDate: input.afterRepairDetail.actualRepairDate,
            emergencyReason: input.afterRepairDetail.emergencyReason,
          })
        : null,
    });
  }

  /**
   * 番号なしのバリエーション内容から、構築済み子明細を含む VariationContent を生成する。
   * C3 AddVariation / C4 UpdateVariation がアプリ層から子 EstimateItem を直接 new せずに
   * 内容を組み立てるための入口（集約境界規約）。採番・差替えは集約ルートの責務。
   */
  static buildVariationContent(content: VariationContentDescriptor): VariationContent {
    const { items, setGroups } = buildVariationChildren(content);
    return {
      items,
      setGroups,
      overallDiscount: content.overallDiscount,
      customerMemo: content.customerMemo,
      internalMemo: content.internalMemo,
    };
  }
}
