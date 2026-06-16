import prisma from "@server/prisma";
import { Prisma } from "@generated/prisma/client";
import { EstimateQueryService } from "@subdomains/estimate/application/queries/EstimateQueryService";
import {
  EstimateDetailDTO,
  LineDTO,
  SetGroupDTO,
  VariationDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { EstimateSummaryDTO } from "@subdomains/estimate/application/queries/dto/EstimateSummaryDTO";
import {
  EstimateListOptions,
  EstimateSearchCriteria,
} from "@subdomains/estimate/application/queries/dto/EstimateSearchCriteria";
import { SetGroupDerivationPolicy } from "@subdomains/estimate/domain/policies/SetGroupDerivationPolicy";
import { Money } from "@subdomains/estimate/domain/values/Money";

/**
 * 見積詳細の読み取り include 定義。集約再構築の ESTIMATE_FULL_INCLUDE とは別に、
 * 表示 DTO に必要なリレーションだけを引く（③ 基本情報の名前・コード解決、明細の商品
 * read-through join・改訂明細詳細）。
 */
const ESTIMATE_DETAIL_INCLUDE = {
  customer: true,
  deliveryLocation: true,
  department: true,
  creator: true,
  variations: {
    orderBy: { variationNumber: "asc" },
    include: {
      // 改訂で生まれたバリエーションは revisionTarget（出自・revisedFrom 相当）を持つ。
      // hasRevision の導出に存在判定のみ使う（ADR-0044）。
      revisionTarget: { select: { sourceVariationId: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        // product は read-through（ADR-0048）で code/区分を解決。revisedDetail は §8.4 改訂価格。
        include: { product: true, revisedDetail: true },
      },
      // セット群（ADR-0047）。product は read-through、components は所属交差表（itemId）。
      setGroups: {
        orderBy: { id: "asc" },
        include: { product: true, components: true },
      },
    },
  },
  // ③ 修理情報（排他サブタイプ）。対象機器を read-through join で解決する。
  repairDetail: { include: { targetProduct: true } },
  afterRepairDetail: { include: { targetProduct: true } },
} satisfies Prisma.EstimateInclude;

type EstimateDetailRow = Prisma.EstimateGetPayload<{ include: typeof ESTIMATE_DETAIL_INCLUDE }>;
type VariationRow = EstimateDetailRow["variations"][number];
type ItemRow = VariationRow["items"][number];
type SetGroupRow = VariationRow["setGroups"][number];

/**
 * 見積一覧（サマリ）の読み取り include 定義。詳細用 ESTIMATE_DETAIL_INCLUDE と違い、
 * 一覧 1 行に必要な最小限だけを引く（得意先・作成者のコード/名称＋代表選択用の軽量 3 列）。
 * variations は variationNumber 昇順で引き、代表選択（find(ACTIVE) ?? [0]）の決定性を担保する。
 */
const ESTIMATE_SUMMARY_INCLUDE = {
  customer: { select: { code: true, name: true } },
  // 一覧「納品先」列は名前のみ（Q1-b）。code は引かない。
  deliveryLocation: { select: { name: true } },
  creator: { select: { employeeCd: true, name: true } },
  variations: {
    orderBy: { variationNumber: "asc" },
    select: { variationNumber: true, status: true, finalTotal: true },
  },
} satisfies Prisma.EstimateInclude;

type EstimateSummaryRow = Prisma.EstimateGetPayload<{ include: typeof ESTIMATE_SUMMARY_INCLUDE }>;

/**
 * EstimateQueryService の Prisma 実装（CQRS read model・計画 Q1）。
 *
 * 集約（Estimate）を再構築せず Prisma を直読みして表示 DTO を組み立てる。集計値は
 * 永続化済みの保存値をそのまま読む（ADR-0033）。
 */
export class PrismaEstimateQueryService implements EstimateQueryService {
  async findByEstimateNumber(estimateNumber: string): Promise<EstimateDetailDTO | null> {
    const row = await prisma.estimate.findUnique({
      where: { estimateNumber },
      include: ESTIMATE_DETAIL_INCLUDE,
    });
    return row ? PrismaEstimateQueryService.toDTO(row) : null;
  }

  /**
   * 一覧用サマリ DTO を検索する（CQRS read model・ADR-0051）。
   *
   * criteria（#349）は estimateNumber/customerName の部分一致・estimateType の等値・
   * activeStatus（代表由来）の絞り込みを受け付ける（buildWhereClause を参照）。件数上限 take は
   * 呼び出し側が options.limit（＝presentation の LIST_FETCH_LIMIT）で渡す。infra から
   * presentation 定数を import するとレイヤリングが逆転するため、ここでは保持しない
   * （product の search と対称）。
   */
  async search(
    criteria: EstimateSearchCriteria,
    options?: EstimateListOptions
  ): Promise<EstimateSummaryDTO[]> {
    const rows = await prisma.estimate.findMany({
      where: PrismaEstimateQueryService.buildWhereClause(criteria),
      include: ESTIMATE_SUMMARY_INCLUDE,
      orderBy: PrismaEstimateQueryService.buildOrderBy(options),
      take: options?.limit,
      skip: options?.offset,
    });
    // variations が空の行はマップ前に除外する。本番は集約不変条件（最低1バリエーション）で
    // 常に length >= 1 のため無影響だが、(1) 共有 dev DB のテスト並行実行で他テストの一過性
    // 空行を読んでも代表選択 throw に踏まないための堅牢化、(2) activeStatus="INACTIVE" の
    // none フィルタが variations 0 件の行に vacuously マッチするエッジの封じ込め、を兼ねる。
    return rows
      .filter((row) => row.variations.length > 0)
      .map((row) => PrismaEstimateQueryService.toSummaryDTO(row));
  }

  /**
   * 検索条件から Prisma の where 句を組み立てる（#349・product の buildWhereClause と同型）。
   * 指定フィールドのみ積み、未指定は絞り込まない（AND 合成。全未指定なら空＝全件）。
   *
   * activeStatus は代表バリエーション由来（ADR-0051）の導出値で単一カラムを持たないが、
   * 代表選択「ACTIVE 優先の最小 → 無ければ全体の最小」の定義上、
   * 「代表が ACTIVE」⟺「ACTIVE が 1 件以上存在」が厳密に成立する。よって some/none の
   * リレーション存在判定として DB 側で絞り込める（mapper の find(ACTIVE) ?? [0] と同じ等価則）。
   */
  private static buildWhereClause(criteria: EstimateSearchCriteria): Prisma.EstimateWhereInput {
    const where: Prisma.EstimateWhereInput = {};

    if (criteria.estimateNumber) {
      where.estimateNumber = { contains: criteria.estimateNumber, mode: "insensitive" };
    }

    if (criteria.customerName) {
      // ADR-0013: リレーション先（得意先）の名前で絞り込む。
      where.customer = { name: { contains: criteria.customerName, mode: "insensitive" } };
    }

    if (criteria.estimateType) {
      where.estimateType = criteria.estimateType as Prisma.EnumEstimateTypeFilter;
    }

    if (criteria.activeStatus === "ACTIVE") {
      // 代表が ACTIVE ⟺ ACTIVE バリエーションが 1 件以上存在（ADR-0051）。
      where.variations = { some: { status: "ACTIVE" } };
    } else if (criteria.activeStatus === "INACTIVE") {
      // 代表が INACTIVE ⟺ ACTIVE バリエーションが 1 件も無い（全 INACTIVE）。
      where.variations = { none: { status: "ACTIVE" } };
    }

    return where;
  }

  /**
   * 一覧の並び順を組み立てる。未指定なら多段既定 [deadline asc, createdAt asc, estimateNumber asc]。
   * 指定時は [指定キー, estimateNumber asc] とし、第 2 キー（unique 列）で安定化する。
   * ソート可能フィールドは Estimate 自身の列に限る（代表由来の金額・状態は不可・ADR-0051）。
   */
  private static buildOrderBy(
    options?: EstimateListOptions
  ): Prisma.EstimateOrderByWithRelationInput[] {
    const orderBy = options?.orderBy;
    if (!orderBy) {
      return [{ deadline: "asc" }, { createdAt: "asc" }, { estimateNumber: "asc" }];
    }
    return [{ [orderBy.field]: orderBy.direction }, { estimateNumber: "asc" }];
  }

  /**
   * 一覧行を組み立てる。金額・状態は代表バリエーション由来（ADR-0051）。
   * 代表 = ACTIVE のうち最小 variationNumber → 無ければ全体の最小（variations は昇順前提）。
   */
  private static toSummaryDTO(e: EstimateSummaryRow): EstimateSummaryDTO {
    const representative = e.variations.find((v) => v.status === "ACTIVE") ?? e.variations[0];
    if (!representative) {
      // 「最低 1 バリエーション」の集約不変条件により通常到達しない（データ破損時の防御）。
      // search からは空行を事前除外済みのため、ここは findByEstimateNumber 等への保険。
      throw new Error(`見積 ${e.estimateNumber} に代表バリエーションが存在しません`);
    }
    return {
      estimateId: e.id,
      estimateNumber: e.estimateNumber,
      estimateType: e.estimateType,
      estimateDate: e.estimateDate,
      deadline: e.deadline,
      // ADR-0013: リレーション先の名前・コードを解決する。
      customerCode: e.customer.code,
      customerName: e.customer.name,
      // 納品先は名前のみ（Q1-b）。
      deliveryLocationName: e.deliveryLocation.name,
      creatorCode: e.creator.employeeCd,
      creatorName: e.creator.name,
      // 永続集計をそのまま読む（再計算しない・ADR-0033）。
      finalTotal: Number(representative.finalTotal),
      activeStatus: representative.status,
      // 表示ステータスは本 issue では常に null（場所だけ予約・ADR-0001/Order 系未実装）。
      displayStatus: null,
    };
  }

  private static toDTO(e: EstimateDetailRow): EstimateDetailDTO {
    return {
      estimateId: e.id,
      estimateNumber: e.estimateNumber,
      estimateType: e.estimateType,
      estimateDate: e.estimateDate,
      deadline: e.deadline,
      version: e.version,
      customerId: e.customerId,
      customerCode: e.customer.code,
      customerName: e.customer.name,
      deliveryLocationId: e.deliveryLocationId,
      deliveryLocationCode: e.deliveryLocation.code,
      deliveryLocationName: e.deliveryLocation.name,
      departmentId: e.departmentId,
      departmentName: e.department.name,
      creatorId: e.createdBy,
      creatorCode: e.creator.employeeCd,
      creatorName: e.creator.name,
      taxRate: Number(e.taxRate),
      taxRoundingType: e.taxRoundingType,
      // 改訂で生まれたバリエーションが 1 件でもあれば改訂済み（domain hasRevision と同義・ADR-0044）。
      hasRevision: e.variations.some((v) => v.revisionTarget !== null),
      repairDetail: e.repairDetail
        ? {
            targetProductId: e.repairDetail.targetProductId,
            targetProductCode: e.repairDetail.targetProduct.code,
            targetProductName: e.repairDetail.targetProduct.name,
            faultDescription: e.repairDetail.faultDescription,
            scheduledRepairDate: e.repairDetail.scheduledRepairDate,
          }
        : null,
      afterRepairDetail: e.afterRepairDetail
        ? {
            targetProductId: e.afterRepairDetail.targetProductId,
            targetProductCode: e.afterRepairDetail.targetProduct.code,
            targetProductName: e.afterRepairDetail.targetProduct.name,
            faultDescription: e.afterRepairDetail.faultDescription,
            actualRepairDate: e.afterRepairDetail.actualRepairDate,
            emergencyReason: e.afterRepairDetail.emergencyReason,
            afterServiceWarningAcknowledged: e.afterRepairDetail.afterServiceWarningAcknowledged,
          }
        : null,
      variations: e.variations.map((v) => PrismaEstimateQueryService.variationToDTO(v)),
    };
  }

  private static variationToDTO(v: VariationRow): VariationDTO {
    return {
      variationId: v.id,
      variationNumber: v.variationNumber,
      status: v.status,
      submissionType: v.submissionType,
      overallDiscount: Number(v.overallDiscount),
      customerMemo: v.customerMemo,
      internalMemo: v.internalMemo,
      subtotal: Number(v.subtotal),
      discountSubtotal: Number(v.discountSubtotal),
      finalSubtotal: Number(v.finalSubtotal),
      taxAmount: Number(v.taxAmount),
      finalTotal: Number(v.finalTotal),
      lines: PrismaEstimateQueryService.buildLines(v),
    };
  }

  /**
   * top-level の明細行（通常明細＋セット群）を組み立てる（ADR-0047）。
   *
   * 1. items を LineDTO 化（sortOrder 昇順は include の orderBy で保証）。
   * 2. 所属交差表（components）で各 item の所属群を引く（item_id PK ＝ 排他所属・高々1）。
   * 3. 群非所属の item は top-level の通常明細、所属 item は群の `components` に内包。
   * 4. 通常明細と群を導出 sortOrder でマージソート（連続配置の不変条件により非交錯）。
   */
  private static buildLines(v: VariationRow): (LineDTO | SetGroupDTO)[] {
    const lineByItemId = new Map<string, LineDTO>(
      v.items.map((i) => [i.id, PrismaEstimateQueryService.itemToLineDTO(i)])
    );

    // itemId → setGroupId（排他所属。交差表 item_id PK なので 1:1）。
    const groupIdByItemId = new Map<string, string>();
    for (const sg of v.setGroups) {
      for (const c of sg.components) {
        groupIdByItemId.set(c.itemId, sg.id);
      }
    }

    const setGroupDTOs = v.setGroups.map((sg) => {
      // 構成明細は sortOrder 昇順（v.items が昇順なので filter で順序が保たれる）。
      const components = v.items
        .filter((i) => groupIdByItemId.get(i.id) === sg.id)
        .map((i) => lineByItemId.get(i.id)!);
      return PrismaEstimateQueryService.setGroupToDTO(sg, components);
    });

    const normalLines = v.items
      .filter((i) => !groupIdByItemId.has(i.id))
      .map((i) => lineByItemId.get(i.id)!);

    return [...normalLines, ...setGroupDTOs].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private static setGroupToDTO(sg: SetGroupRow, components: LineDTO[]): SetGroupDTO {
    // 金額・表示位置は write 側 deriveSetGroup と同じ Policy で導出（単一ソース・Q2）。
    // 構成明細 finalAmount（円・主単位）を Money に戻して合計し、表示位置は最小 sortOrder。
    const derived = SetGroupDerivationPolicy.derive(
      components.map((c) => ({
        finalAmount: Money.fromMajorUnits(c.finalAmount),
        sortOrder: c.sortOrder,
      }))
    );
    return {
      kind: "setGroup",
      setGroupId: sg.id,
      productId: sg.productId,
      // read-through（ADR-0048）。
      productCode: sg.product.code,
      productCategory: sg.product.category,
      itemName: sg.itemName,
      unit: sg.unit,
      customerMemo: sg.customerMemo,
      internalMemo: sg.internalMemo,
      amount: derived.amount.majorUnits,
      sortOrder: derived.sortOrder,
      components,
    };
  }

  private static itemToLineDTO(i: ItemRow): LineDTO {
    return {
      kind: "line",
      itemId: i.id,
      productId: i.productId,
      // read-through（ADR-0048）。product FK は onDelete 既定 Restrict のため常に解決する。
      productCode: i.product.code,
      productCategory: i.product.category,
      itemName: i.itemName,
      sortOrder: i.sortOrder,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: Number(i.unitPrice),
      discountRate: Number(i.discountRate),
      itemDiscount: Number(i.itemDiscount),
      baseAmount: Number(i.baseAmount),
      finalAmount: Number(i.finalAmount),
      customerMemo: i.customerMemo,
      internalMemo: i.internalMemo,
      revisedDeliveryPrice: i.revisedDetail ? Number(i.revisedDetail.deliveryPrice) : null,
    };
  }
}
