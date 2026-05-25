import { Money } from "../values/Money";
import { RevisedEstimateItemDetailId } from "../values/RevisedEstimateItemDetailId";

/**
 * 改訂明細詳細エンティティ（EstimateItem の 1:1 子要素、§11.3.1）。
 *
 * 得意先改訂で生まれた明細だけが持つ固有属性。「行が存在 ⟺ その明細は改訂で
 * 生まれた」という意味論であり、deliveryPrice は改訂元の納品先明細価格の
 * スナップショット（粗利計算の真実の源・§8.4）。
 *
 * 本クラスは Estimate 集約の内部子エンティティ。バレル
 * (entities/index.ts) からは export せず、集約外コードからの直接
 * インスタンス化を構造的に禁止する。public メソッドは集約ルート
 * (Estimate) または親 EstimateItem からのみ呼ばれる前提。
 */
export class RevisedEstimateItemDetail {
  static readonly ENTITY_NAME = "改訂明細詳細";

  private constructor(
    private readonly _id: RevisedEstimateItemDetailId,
    private _deliveryPrice: Money,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  static create(deliveryPrice: Money): RevisedEstimateItemDetail {
    const now = new Date();
    return new RevisedEstimateItemDetail(
      RevisedEstimateItemDetailId.generate(),
      deliveryPrice,
      now,
      now
    );
  }

  static reconstruct(
    id: RevisedEstimateItemDetailId,
    deliveryPrice: Money,
    createdAt: Date,
    updatedAt: Date
  ): RevisedEstimateItemDetail {
    return new RevisedEstimateItemDetail(id, deliveryPrice, createdAt, updatedAt);
  }

  changeDeliveryPrice(newPrice: Money): void {
    this._deliveryPrice = newPrice;
    this._updatedAt = new Date();
  }

  get id(): RevisedEstimateItemDetailId {
    return this._id;
  }

  get deliveryPrice(): Money {
    return this._deliveryPrice;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
