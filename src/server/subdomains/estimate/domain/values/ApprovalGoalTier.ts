import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

const VALID_VALUES = [
  "SECTION_MANAGER",
  "DEPARTMENT_MANAGER",
  "DIVISION_MANAGER",
  "PRESIDENT",
] as const;
type ApprovalGoalTierValue = (typeof VALID_VALUES)[number];

const LABEL_MAP: Record<ApprovalGoalTierValue, string> = {
  SECTION_MANAGER: "課長",
  DEPARTMENT_MANAGER: "部長",
  DIVISION_MANAGER: "本部長",
  PRESIDENT: "社長",
};

// 承認権限の昇順（課長 < 部長 < 本部長 < 社長）。段階比較の唯一の根拠。
const RANK_MAP: Record<ApprovalGoalTierValue, number> = {
  SECTION_MANAGER: 1,
  DEPARTMENT_MANAGER: 2,
  DIVISION_MANAGER: 3,
  PRESIDENT: 4,
};

/**
 * 承認ゴール段階の値オブジェクト（estimate ドメインの抽象段階・ADR-0062）
 *
 * `ApprovalRequirementPolicy` が金額閾値（§4.2）から算出して返す **抽象的な承認ゴール段階**。
 * 具体的な `Position` の identity（どの役職が課長か）は組織サブドメインの持ち物であり、
 * 本 VO はそれを一切知らない。`ApprovalChainBuilder`（§5）が組織スナップショットを使って
 * この段階を具体役職へ解決する。
 *
 * 役職階層（課長 < 部長 < 本部長 < 社長・§5.1）に対応する4段で、`rank` による段階比較
 * （`isAtLeast`）を提供する。チェーン構築時に「辿り着いた役割の役職段階がゴール段階に
 * 到達したか」を判定するために使う。
 */
export class ApprovalGoalTier extends ValueObject<string, "ApprovalGoalTier"> {
  static readonly SECTION_MANAGER = new ApprovalGoalTier("SECTION_MANAGER");
  static readonly DEPARTMENT_MANAGER = new ApprovalGoalTier("DEPARTMENT_MANAGER");
  static readonly DIVISION_MANAGER = new ApprovalGoalTier("DIVISION_MANAGER");
  static readonly PRESIDENT = new ApprovalGoalTier("PRESIDENT");

  private constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  /** 業務表示名（「課長」/「部長」/「本部長」/「社長」）。 */
  get label(): string {
    return LABEL_MAP[this._value as ApprovalGoalTierValue];
  }

  /** 承認権限の段階順位（課長=1 〜 社長=4）。段階比較の根拠。 */
  get rank(): number {
    return RANK_MAP[this._value as ApprovalGoalTierValue];
  }

  /** この段階が指定段階以上（同段含む）に到達しているか。 */
  isAtLeast(other: ApprovalGoalTier): boolean {
    return this.rank >= other.rank;
  }

  /** Prisma 値・永続化値から生成する。 */
  static from(value: string): ApprovalGoalTier {
    switch (value) {
      case "SECTION_MANAGER":
        return ApprovalGoalTier.SECTION_MANAGER;
      case "DEPARTMENT_MANAGER":
        return ApprovalGoalTier.DEPARTMENT_MANAGER;
      case "DIVISION_MANAGER":
        return ApprovalGoalTier.DIVISION_MANAGER;
      case "PRESIDENT":
        return ApprovalGoalTier.PRESIDENT;
      default:
        throw new ValidationError(
          `不正な承認ゴール段階です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
        );
    }
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as ApprovalGoalTierValue)) {
      throw new ValidationError(
        `不正な承認ゴール段階です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
      );
    }
  }
}
