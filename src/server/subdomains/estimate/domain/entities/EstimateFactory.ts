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

/** 明細の記述子（値オブジェクト止まり。改訂明細詳細は納品価格 VO から本ファクトリが構築）。 */
export type EstimateItemDescriptor = {
  productId: ProductId;
  sortOrder: number;
  itemName: ItemName;
  quantity: Quantity;
  unit: Unit;
  unitPrice: Money;
  discountRate?: DiscountRate;
  itemDiscount?: Money;
  customerMemo?: Memo;
  internalMemo?: Memo;
  /** 得意先改訂で生まれた明細のみ持つ納品価格。指定時のみ改訂明細詳細を構築する。 */
  revisedDeliveryPrice?: Money | null;
};

/**
 * セット群の記述子（ADR-0047 / Shape ③-a）。構成明細を入れ子の `components` で持つ。
 *
 * **入れ子の理由（会員解決）**: 構成明細は `EstimateItem.create` で初めて id が確定するため、
 * 記述子の段階では「どの構成明細がこの群に属すか」を id では参照できない。群に構成明細を
 * 入れ子で持たせることで、ファクトリが構成を構築 → 生成 id を捕捉 → 群へ配線できる。
 * これは読み取り DTO（`SetGroupDTO.components`）・作業コピー（往復形状 A）と対称。
 */
export type EstimateSetGroupDescriptor = {
  productId: ProductId;
  /** 商品名スナップショット（SET 商品マスタからの複写）。 */
  itemName: ItemName;
  /** 単位スナップショット。 */
  unit: Unit;
  /** 構成明細（入れ子）。空配列は不可（空群禁止は EstimateSetGroup.create が担保）。 */
  components: EstimateItemDescriptor[];
  customerMemo?: Memo;
  internalMemo?: Memo;
};

/** バリエーションの記述子（値オブジェクト止まり）。 */
export type EstimateVariationDescriptor = {
  variationNumber: number;
  /** 提出区分（ADR-0045: バリエーション単位の不変保存属性。記述子ごとに指定する） */
  submissionType: SubmissionType;
  /** 通常明細（非セット）の記述子。構成明細は setGroups の入れ子側に持つ。 */
  items: EstimateItemDescriptor[];
  /**
   * セット群（ADR-0047）。各群が構成明細を入れ子で持つ。セット群が無い場合は空配列を明示する。
   *
   * **必須の理由（#617）**: optional は「正規化する単一の所有者」が居るときだけ許す。undefined の
   * 発生源はフォーム入力境界であってドメインではないため、`?? []` による正規化はアプリ層の
   * マッパ（フォーム入力 → 記述子）へ押し出し、ドメインには常に配列が届く状態を型で保つ。
   */
  setGroups: EstimateSetGroupDescriptor[];
  overallDiscount?: Money;
  customerMemo?: Memo;
  internalMemo?: Memo;
};

/**
 * 番号を含まないバリエーション内容の記述子。C3 AddVariation（番号は集約が採番）と
 * C4 UpdateVariation（番号は変更しない）で共用する。
 * 提出区分は不変属性（ADR-0045）のため C4 で指定できず、ここから型レベルで除外する。
 * C3 では番号同様にバリエーション内容の外側で受け取る。
 */
export type VariationContentDescriptor = Omit<
  EstimateVariationDescriptor,
  "variationNumber" | "submissionType"
>;

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

/** 見積集約生成の入力（すべて値オブジェクト／記述子で構成）。 */
export type EstimateFactoryInput = {
  estimateNumber: EstimateNumber;
  estimateDate: Date;
  deadline: Date;
  customerId: CustomerId;
  deliveryLocationId: DeliveryLocationId;
  taxRate: TaxRate;
  taxRoundingType: TaxRoundingType;
  createdBy: EmployeeId;
  departmentId: DepartmentId;
  variations: EstimateVariationDescriptor[];
  repairDetail?: RepairDetailDescriptor | null;
  afterRepairDetail?: AfterRepairDetailDescriptor | null;
};

/**
 * 単価再解決を伴う引き継ぎ生成（複製先・改訂先）専用の明細記述子の土台（#617・ADR-20260716-w4k）。
 *
 * **2 つの `Omit` の用途を区別すること**:
 * - ここでの `Omit` は**クリア**（＝引き継ぎ先へ持ち込まない項目を「名前すら書けない」状態にする）。
 *   `itemDiscount` は単価を宛先へ再解決した経路で持ち込むと不整合になるため型から消す
 *   （不変則 ADR-20260714-pv8・#598）。`revisedDeliveryPrice` は経路で意味が変わるため土台からは
 *   消し、改訂経路 {@link RevisedItemDescriptor} でのみ必須として足し直す。
 * - 下位の {@link RepricedSetGroupDescriptor} 等での `Omit` は**置換**（入れ子の明細型差し替え）。
 *
 * **`Required<>` で機械導出する理由**: 維持フィールドを手で列挙すると、将来
 * {@link EstimateItemDescriptor} に optional が増えたとき引き継ぎ側へ optional のまま流れ込み、
 * コンパイルが通るので誰も気づかない（#602 / #603 と同型の silent data loss）。`Required<>` なら
 * 新フィールドが自動で必須化され、populate 箇所がコンパイルエラーになる＝判断を書き手に強制できる。
 */
export type RepricedItemDescriptor = Required<
  Omit<EstimateItemDescriptor, "itemDiscount" | "revisedDeliveryPrice">
>;

/**
 * 複製で生まれる明細の記述子。改訂明細詳細は複製先に生えないため `revisedDeliveryPrice` は
 * 土台の `Omit` のまま（名前すら書けない）。
 */
export type CopiedItemDescriptor = RepricedItemDescriptor;

/**
 * 得意先改訂で生まれる明細の記述子。改訂元 `finalAmount` のスナップショットを**必須**で持つ。
 *
 * **必須の理由（#617）**: optional に残すと改訂経路の書き忘れで改訂明細詳細が黙って生成されず、
 * §8.4 の比較基準が消える（#602 と同型の未発火 silent data loss）。逆に複製経路でうっかり
 * 書ける穴も塞ぐため、複製用と改訂用で記述子を割る。
 */
export type RevisedItemDescriptor = RepricedItemDescriptor & { revisedDeliveryPrice: Money };

/**
 * 単価再解決経路のセット群記述子。構成明細を明細型 `I` で径数化する（構成明細も固定値引不可）。
 * ここでの `Omit` は**置換**（入れ子の `components` を経路ごとの明細型へ差し替える）。
 */
export type RepricedSetGroupDescriptor<I extends RepricedItemDescriptor = RepricedItemDescriptor> =
  Required<Omit<EstimateSetGroupDescriptor, "components">> & { components: I[] };

/**
 * 単価再解決経路のバリエーション記述子。全体値引 `overallDiscount` を型から消し（クリア）、
 * 通常明細・セット群を経路ごとの明細型 `I` に差し替える（置換）。
 *
 * **generics で径数化する理由**: 複製系・改訂系を別々に定義すると `Required<Omit<...>>`
 * （＝クリア判断の全量）が 2 箇所に重複し、将来クリア対象が増えたとき片方だけ直る余地が
 * 生まれる（#602 と同型の再生産）。
 */
export type RepricedVariationDescriptor<I extends RepricedItemDescriptor = RepricedItemDescriptor> =
  Required<Omit<EstimateVariationDescriptor, "overallDiscount" | "items" | "setGroups">> & {
    items: I[];
    setGroups: RepricedSetGroupDescriptor<I>[];
  };

/**
 * 複製で生まれるバリエーションの記述子。複製元バリエーション（出自）を id 参照として添える。
 * C6 DuplicateEstimate で「新バリエーションの生成 id ↔ 複製元 id」の系譜を作るために用いる。
 * 単価再解決経路のため repriced 記述子を土台にし、固定値引は型で禁止する（#603・ADR-20260714-pv8）。
 */
export type CopiedVariationDescriptor = RepricedVariationDescriptor<CopiedItemDescriptor> & {
  sourceVariationId: EstimateVariationId;
};

/** 得意先改訂で生まれるバリエーションの記述子。明細は改訂納品価格必須の記述子で持つ（#617）。 */
export type RevisedVariationDescriptor = RepricedVariationDescriptor<RevisedItemDescriptor>;

/** 見積複製の入力。variations 以外は新規生成と同じ記述子で、variations のみ系譜付き記述子。 */
export type EstimateDuplicateInput = Omit<EstimateFactoryInput, "variations"> & {
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
    input: Omit<EstimateFactoryInput, "variations">,
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
