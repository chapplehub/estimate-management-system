import { Money } from "@server/shared/domain/values/Money";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import {
  type ResolveSellingPriceQuery,
  type SellingPriceResolutionTarget,
} from "@subdomains/pricing/application/queries/ResolveSellingPriceQuery";

/**
 * 価格決定の実行口（ADR-20260626-p3w）。テストでモック可能なよう `execute` のみを要求する
 * 構造型として受ける。本物の {@link ResolveSellingPriceQuery} はこれを満たす。
 */
export type SellingPriceResolver = Pick<ResolveSellingPriceQuery, "execute">;

/** バリエーション単位で共通の宛先コンテキスト（提出区分＋宛先ID＋見積年月日）。 */
export type LinePriceContext = {
  submissionType: SubmissionType;
  customerId: string;
  deliveryLocationId: string;
  estimateDate: Date;
};

/** 単価を確定したい明細行の仕様。 */
export type LinePriceRequest = {
  productId: string;
  /**
   * C4 内容編集で既存明細を突合する任意キー（ADR-20260709-5ea）。現行集約の同一 itemId・同一 productId
   * の行と一致すれば永続単価を保全し、価格決定を呼ばない。不一致・偽造 ID は無視され新規行として解決される。
   */
  itemId?: string;
};

/** 既存明細の永続単価（C4 突合用）。C1/C3 では空マップを渡す。 */
export type ExistingLinePrice = {
  productId: string;
  unitPrice: Money;
};

/**
 * 明細行群の見積単価を価格決定（#428・ADR-0064）で確定する共有ヘルパー。
 *
 * 責務（ADR-20260626-p3w の消費側マッピングをアプリ層に置く）:
 * - 各行の `productId` を提出区分に応じた {@link SellingPriceResolutionTarget} へマップする。
 * - 解決対象の商品IDをデデュープし `Promise.all` で並列解決する（同一商品の複数行は1回だけ引く）。
 * - `SellingUnitPrice` → `Money` へ変換して行順のまま返す。
 * - C4 既存行保全（ADR-20260709-5ea）: `itemId` が `existingLines` と一致しかつ `productId` 不変なら
 *   永続単価を保全する。新規行・商品変更行・不一致 ID の行のみ価格決定で解決する。
 * - 解決不能（{@link SellingPriceResolver} が `BusinessRuleViolationError` を投げる）はそのまま伝播する。
 *
 * ドメインは解決済み `Money` を受け取るだけで pricing を import しない（DDD レイヤ規約）。
 *
 * @returns `requests` と同順・同数の解決済み単価（`Money`）。
 */
export async function resolveLinePrices(
  requests: readonly LinePriceRequest[],
  context: LinePriceContext,
  resolver: SellingPriceResolver,
  existingLines: ReadonlyMap<string, ExistingLinePrice> = new Map()
): Promise<Money[]> {
  // 各行が「既存永続値の保全」か「価格決定での解決」かを判定する。保全対象は解決集合に入れない。
  const productIdsToResolve = new Set<string>();
  for (const request of requests) {
    if (preservedPriceFor(request, existingLines) === null) {
      productIdsToResolve.add(request.productId);
    }
  }

  // デデュープした商品IDを並列解決し、商品ID→Money の索引を作る。
  const resolvedByProductId = new Map<string, Money>();
  await Promise.all(
    [...productIdsToResolve].map(async (productId) => {
      const price = await resolver.execute(toSellingPriceTarget(productId, context));
      resolvedByProductId.set(productId, price.money);
    })
  );

  return requests.map((request) => {
    const preserved = preservedPriceFor(request, existingLines);
    if (preserved !== null) {
      return preserved;
    }
    // 解決集合に入れた商品なので必ず索引に存在する。
    return resolvedByProductId.get(request.productId)!;
  });
}

/** 価格を確定したい明細ツリー（通常明細＋セット群の入れ子構成明細）。 */
export type LinePriceTree<L extends LinePriceRequest> = {
  items: readonly L[];
  setGroups?: readonly { components: readonly L[] }[];
};

/**
 * 明細ツリー（通常明細＋セット構成明細）の見積単価を解決し、行オブジェクト参照をキーとする
 * `Map` で返す。呼び出し側は入れ子を平坦化・再構築せず `priceMap.get(line)` で解決済み `Money` を
 * 引ける（インデックス整合の壊れやすさを排除する）。
 *
 * 平坦化は「通常明細 → 各セット群の構成明細」の順で行い、{@link resolveLinePrices} にそのまま渡す
 * （デデュープ・並列解決・既存行保全・例外伝播は同関数に委ねる）。C1/C3/C4 の各コマンドで共用する。
 */
export async function resolveLineTreePrices<L extends LinePriceRequest>(
  tree: LinePriceTree<L>,
  context: LinePriceContext,
  resolver: SellingPriceResolver,
  existingLines: ReadonlyMap<string, ExistingLinePrice> = new Map()
): Promise<ReadonlyMap<L, Money>> {
  const lines: L[] = [
    ...tree.items,
    ...(tree.setGroups ?? []).flatMap((group) => [...group.components]),
  ];
  const prices = await resolveLinePrices(lines, context, resolver, existingLines);
  return new Map(lines.map((line, index) => [line, prices[index]]));
}

/**
 * 既存明細の突合が成立する（itemId 一致かつ productId 不変）なら永続単価を返し、そうでなければ null。
 * null は「価格決定で解決すべき行」を意味する。
 */
function preservedPriceFor(
  request: LinePriceRequest,
  existingLines: ReadonlyMap<string, ExistingLinePrice>
): Money | null {
  if (request.itemId === undefined) {
    return null;
  }
  const existing = existingLines.get(request.itemId);
  if (existing === undefined || existing.productId !== request.productId) {
    return null;
  }
  return existing.unitPrice;
}

/**
 * 商品ID＋宛先コンテキストを、提出区分に応じた価格決定ターゲットへマップする（消費側マッピング・
 * ADR-20260626-p3w）。C1/C3/C4 の {@link resolveLinePrices} と C6/C7 の複製・改訂コマンドで共用し、
 * 「納品先宛なのに customerId」を型で排除する分岐を単一ソースに保つ。
 */
export function toSellingPriceTarget(
  productId: string,
  context: LinePriceContext
): SellingPriceResolutionTarget {
  if (context.submissionType.isDeliveryLocation()) {
    return {
      addressee: "DELIVERY_LOCATION",
      deliveryLocationId: context.deliveryLocationId,
      productId,
      estimateDate: context.estimateDate,
    };
  }
  return {
    addressee: "CUSTOMER",
    customerId: context.customerId,
    productId,
    estimateDate: context.estimateDate,
  };
}
