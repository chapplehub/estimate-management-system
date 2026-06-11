import { InvalidArgumentError } from "@server/shared/errors/DomainError";
import { EstimateVariationId } from "./EstimateVariationId";

/**
 * 見積複製の系譜（複製先バリエーション → 複製元バリエーション）を表す値オブジェクト。
 *
 * 複製元と複製先という別々の集約インスタンスをまたぐ関連であり、どちらの集約にも属さない
 * 兄弟成果物として扱う（ADR-0040）。複製先は出自を高々 1 つしか持たず
 * （`copiedVariationId` が一意）、`copiedVariationId → sourceVariationId` の関数従属が
 * 成立するため、永続化では `copiedVariationId` を自然主キーとする（ADR-0041）。
 * よって独自の identity（サロゲート id）は持たない。
 */
export class EstimateVariationCopy {
  private constructor(
    private readonly _copiedVariationId: EstimateVariationId,
    private readonly _sourceVariationId: EstimateVariationId
  ) {}

  /**
   * 系譜を生成する。複製先（このバリエーションが複製で生まれた）と複製元（出自）を受け取る。
   * 自分自身を出自とする系譜は成立しないため拒否する。
   */
  static create(
    copiedVariationId: EstimateVariationId,
    sourceVariationId: EstimateVariationId
  ): EstimateVariationCopy {
    if (copiedVariationId.equals(sourceVariationId)) {
      throw new InvalidArgumentError(
        "複製先と複製元が同一のバリエーションを指す系譜は生成できません"
      );
    }
    return new EstimateVariationCopy(copiedVariationId, sourceVariationId);
  }

  /** 複製で生まれたバリエーション（自然キー）。 */
  get copiedVariationId(): EstimateVariationId {
    return this._copiedVariationId;
  }

  /** 複製元バリエーション（別集約を id 参照）。 */
  get sourceVariationId(): EstimateVariationId {
    return this._sourceVariationId;
  }

  equals(other: EstimateVariationCopy): boolean {
    return (
      this._copiedVariationId.equals(other._copiedVariationId) &&
      this._sourceVariationId.equals(other._sourceVariationId)
    );
  }
}
