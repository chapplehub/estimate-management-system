import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { type SellingPriceResolutionTarget } from "@subdomains/pricing/application/queries/ResolveSellingPriceQuery";
import { type SellingPriceResolver } from "./resolveLinePrices";

/**
 * 見積単価を1件解決したい要求。
 * - `key`: 呼び出し側が解決スキームに応じて定める、返却マップの一意キー
 *   （複製は `提出区分×商品ID`、改訂は `商品ID`）。同一キーは1回だけ解決される。
 * - `productName`: 解決不能時のエラー列挙に使う商品名（明細スナップショット・ADR-0048 から取る）。
 * - `target`: 提出区分・宛先・見積年月日を含む価格決定ターゲット（消費側マッピングは呼び出し側の責務）。
 */
export type UnitPriceResolutionRequest = {
  key: string;
  productName: string;
  target: SellingPriceResolutionTarget;
};

/**
 * 複製先・改訂先の生成時に、明細群の見積単価を価格決定で一括解決する共有ヘルパー（C6/C7・#431）。
 *
 * 既存 {@link import("./resolveLinePrices").resolveLinePrices}（C1/C3/C4）が「最初の解決不能で即 throw」
 * するのに対し、本ヘルパは {@link Promise.allSettled} で**全件の解決を試み、解決不能な商品を商品名で
 * 一括列挙**して単一の {@link BusinessRuleViolationError} で拒否する（設計判断 B・ADR-20260710-q7t）。
 * 複製元が古く複数商品の販売単価が失効している典型シナリオで、ユーザに1件ずつの再試行を強いない。
 *
 * 価格決定以外の失敗（インフラ障害等・{@link BusinessRuleViolationError} でない reject）は握り潰さず、
 * 最初の1件をそのまま伝播する（「販売単価未設定」への誤変換を防ぐ）。
 *
 * ドメインは戻り値の解決済み `Money` マップを受け取るだけで pricing を import しない（DDD レイヤ規約）。
 *
 * @returns `key → 解決済み Money` のマップ（要求キーで一意化済み）。
 */
export async function resolveUnitPricesOrReject(
  requests: readonly UnitPriceResolutionRequest[],
  resolver: SellingPriceResolver
): Promise<ReadonlyMap<string, Money>> {
  // キーで一意化する（同一商品の複数明細は1回だけ引く）。最初の出現を代表として保持する。
  const uniqueByKey = new Map<string, UnitPriceResolutionRequest>();
  for (const request of requests) {
    if (!uniqueByKey.has(request.key)) {
      uniqueByKey.set(request.key, request);
    }
  }

  const entries = [...uniqueByKey.values()];
  const settled = await Promise.allSettled(entries.map((entry) => resolver.execute(entry.target)));

  const resolved = new Map<string, Money>();
  const unresolvedNames: string[] = [];
  let unexpectedError: unknown = null;
  settled.forEach((result, index) => {
    const entry = entries[index];
    if (result.status === "fulfilled") {
      resolved.set(entry.key, result.value.money);
    } else if (result.reason instanceof BusinessRuleViolationError) {
      unresolvedNames.push(entry.productName);
    } else if (unexpectedError === null) {
      unexpectedError = result.reason;
    }
  });

  // 価格決定と無関係な失敗を「販売単価未設定」に取り違えないよう、これを優先して伝播する。
  if (unexpectedError !== null) {
    throw unexpectedError;
  }

  if (unresolvedNames.length > 0) {
    const uniqueNames = [...new Set(unresolvedNames)];
    throw new BusinessRuleViolationError(
      `販売単価が設定されていない商品があります: ${uniqueNames.join("、")}`
    );
  }

  return resolved;
}
