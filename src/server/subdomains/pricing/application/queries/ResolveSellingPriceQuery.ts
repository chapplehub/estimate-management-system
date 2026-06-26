import { Money } from "@server/shared/domain/values/Money";
import { PriceResolutionPolicy } from "@subdomains/pricing/domain/policies/PriceResolutionPolicy";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { ResolveCommonSellingPriceQuery } from "./ResolveCommonSellingPriceQuery";
import { ResolveCustomerSellingPriceQuery } from "./ResolveCustomerSellingPriceQuery";
import { ResolveDeliveryLocationSellingPriceQuery } from "./ResolveDeliveryLocationSellingPriceQuery";
import { SellingPriceResolutionDTO } from "./dto/SellingPriceResolutionDTO";

/**
 * 価格決定オーケストレーションの入口（提出区分ごとの宛先 ID ＋ 見積年月日）。
 *
 * estimate の `SubmissionType` には依存せず、pricing 独自のタグ付き共用体で受ける（ADR-20260626-p3w）。
 * `addressee` 判別子により「納品先宛なのに customerId」を型で排除し、正しい上書き層の選択地点とする
 * （クロス参照を型で封じる・ADR-20260624-8tg と相補）。消費側（#430）が `SubmissionType` ＋宛先 ID を
 * この型へマップする。
 */
export type SellingPriceResolutionTarget =
  | { addressee: "CUSTOMER"; customerId: string; productId: string; estimateDate: Date }
  | {
      addressee: "DELIVERY_LOCATION";
      deliveryLocationId: string;
      productId: string;
      estimateDate: Date;
    };

/**
 * 見積年月日・提出区分から見積単価を一意に解決する2段解決オーケストレーション（価格決定・#428）。
 *
 * ① 見積年月日(`Date`)→JST 暦日への変換を1度だけ行う（ADR-20260624-95f）。
 * ② 提出区分に応じた上書き層（得意先別 or 納品先別）と共通層の時点解決 QueryService を呼ぶ。
 * ③ DTO（10進文字列）→VO（`SellingUnitPrice`）へアプリ層で変換し、純 {@link PriceResolutionPolicy} に委譲する。
 *
 * 解決不能（上書きも共通も無い）は Policy が `BusinessRuleViolationError` を throw する。
 */
export class ResolveSellingPriceQuery {
  constructor(
    private readonly commonQuery: ResolveCommonSellingPriceQuery,
    private readonly customerQuery: ResolveCustomerSellingPriceQuery,
    private readonly deliveryLocationQuery: ResolveDeliveryLocationSellingPriceQuery
  ) {}

  async execute(target: SellingPriceResolutionTarget): Promise<SellingUnitPrice> {
    const date = toJstCalendarDay(target.estimateDate);

    // 上書き層と共通層は互いに出力依存が無いため並列に解決する。Policy が `override ?? common`
    // で先勝ちするため共通層は上書きヒット時に捨てられるが、上書き層は例外的存在で多数派は共通層
    // に着地する設計上、常時並列のほうが短絡（上書きnull時のみ共通取得）より総レイテンシが小さい。
    const overridePromise =
      target.addressee === "CUSTOMER"
        ? this.customerQuery.execute({
            customerId: target.customerId,
            productId: target.productId,
            date,
          })
        : this.deliveryLocationQuery.execute({
            deliveryLocationId: target.deliveryLocationId,
            productId: target.productId,
            date,
          });

    const commonPromise = this.commonQuery.execute({ productId: target.productId, date });

    const [overrideDto, commonDto] = await Promise.all([overridePromise, commonPromise]);

    return PriceResolutionPolicy.resolve({
      override: toSellingUnitPrice(overrideDto),
      common: toSellingUnitPrice(commonDto),
      productId: target.productId,
      addressee: target.addressee,
    });
  }
}

/** 時点解決 DTO（10進文字列）を `SellingUnitPrice` VO へ変換する。null は該当なしとしてそのまま透過。 */
function toSellingUnitPrice(dto: SellingPriceResolutionDTO | null): SellingUnitPrice | null {
  if (dto === null) {
    return null;
  }
  return SellingUnitPrice.fromMoney(Money.fromDecimalString(dto.sellingPrice));
}
