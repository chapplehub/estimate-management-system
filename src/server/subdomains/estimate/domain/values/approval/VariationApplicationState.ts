import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";
import { ApplicationStatus, type ApplicationStatusCode } from "./ApplicationStatus";

const VALID_VALUES = ["NONE", "PENDING", "REJECTED", "WITHDRAWN", "APPROVED", "EXEMPTED"] as const;

/**
 * バリエーション申請状態の code 集合（6値）。
 *
 * ADR-0069 に従い、境界（DTO）の状態語彙はこの VO を単一ソースとする。読み取り DTO の
 * `applicationState.code` はこの型で、FE は直 type-import で消費する（ミラー禁止）。
 */
export type VariationApplicationStateCode = (typeof VALID_VALUES)[number];

/** NONE / EXEMPTED の label（申請と重ならない2値のみ自前で持つ）。 */
const OWN_LABEL: Record<"NONE" | "EXEMPTED", string> = {
  NONE: "未申請",
  EXEMPTED: "承認不要",
};

/**
 * バリエーション申請状態の値オブジェクト（6値・ADR-20260706-u7z）
 *
 * **保存しない**。見積詳細画面（S2）の「申請ボタン出し分け」「バリエーション別バッジ」を
 * 駆動する読み取りモデルが、バリエーション1件の申請観点状態を1値で表すためのメモリ上の VO。
 *
 * `ApplicationStatus`(4値・1申請の導出状態) を拡張せず**再利用**する（主語が異なる。
 * `ApplicationStatus`=申請の状態／本 VO=バリエーションの状態）。差分の2値——未申請（NONE・
 * 申請行が1件も無い）と承認不要（EXEMPTED・別集約 `EstimateApprovalExemption` 由来の免除・
 * ADR-0054）——は「申請の状態」ではないため、`ApplicationStatus` には持ち込まない。
 *
 * - label: 重なる4値は {@link ApplicationStatus.label} へ委譲（二重定義せずドリフトを防ぐ）。
 *   NONE=「未申請」/ EXEMPTED=「承認不要」のみ自前。
 * - `isAdvancing()`: CONTEXT「前進バリエーション（申請中・承認済・免除）」と 1:1。
 * - {@link reduce}: バリエーション単位の畳み込み還元先。前進判定・バッジ表示を本 VO に集約する。
 */
export class VariationApplicationState extends ValueObject<string, "VariationApplicationState"> {
  static readonly NONE = new VariationApplicationState("NONE");
  static readonly PENDING = new VariationApplicationState("PENDING");
  static readonly REJECTED = new VariationApplicationState("REJECTED");
  static readonly WITHDRAWN = new VariationApplicationState("WITHDRAWN");
  static readonly APPROVED = new VariationApplicationState("APPROVED");
  static readonly EXEMPTED = new VariationApplicationState("EXEMPTED");

  private constructor(value: string) {
    super(value);
  }

  /** 状態コード（境界 DTO の `code` の単一ソース・ADR-0069）。 */
  get code(): VariationApplicationStateCode {
    return this._value as VariationApplicationStateCode;
  }

  /**
   * 業務表示名。重なる4値は {@link ApplicationStatus.label} へ委譲し、
   * NONE=「未申請」/ EXEMPTED=「承認不要」のみ自前で返す。
   */
  get label(): string {
    if (this._value === "NONE" || this._value === "EXEMPTED") {
      return OWN_LABEL[this._value];
    }
    return APPLICATION_STATUS_BY_CODE[this._value as ApplicationStatusCode].label;
  }

  /**
   * 「前進」中か（前進バリエーション＝申請中・承認済・免除・CONTEXT）。
   * 「1見積1前進」の中核述語。NONE・REJECTED・WITHDRAWN は前進枠を空ける（非前進）。
   */
  isAdvancing(): boolean {
    return (
      this === VariationApplicationState.PENDING ||
      this === VariationApplicationState.APPROVED ||
      this === VariationApplicationState.EXEMPTED
    );
  }

  /**
   * バリエーション単位の畳み込み還元（上から評価し最初に一致）:
   * ① 免除行あり → EXEMPTED（最優先）
   * ② 申請行あり → 最新 attempt（max）の導出状態を写す
   * ③ どちらも無し → NONE（未申請）
   *
   * 入力は materialize 済みの事実に限る。各申請の導出状態は §3.6 の共有純粋関数
   * （deriveApplicationStatus）で作った {@link ApplicationStatus} を渡す（書き込みと同一ロジック）。
   */
  static reduce(facts: {
    isExempted: boolean;
    applications: ReadonlyArray<{ attempt: number; status: ApplicationStatus }>;
  }): VariationApplicationState {
    if (facts.isExempted) {
      return VariationApplicationState.EXEMPTED;
    }
    const latest = facts.applications.reduce<{ attempt: number; status: ApplicationStatus } | null>(
      (max, application) => (max === null || application.attempt > max.attempt ? application : max),
      null
    );
    if (latest === null) {
      return VariationApplicationState.NONE;
    }
    return VARIATION_STATE_BY_APPLICATION_CODE[latest.status.value as ApplicationStatusCode];
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as VariationApplicationStateCode)) {
      throw new ValidationError(
        `不正なバリエーション申請状態です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
      );
    }
  }
}

/** 重なる4値 code → `ApplicationStatus`（label 委譲の逆引き）。網羅は型で保証。 */
const APPLICATION_STATUS_BY_CODE: Record<ApplicationStatusCode, ApplicationStatus> = {
  PENDING: ApplicationStatus.PENDING,
  APPROVED: ApplicationStatus.APPROVED,
  REJECTED: ApplicationStatus.REJECTED,
  WITHDRAWN: ApplicationStatus.WITHDRAWN,
};

/** 申請の導出状態(4値) → バリエーション申請状態(6値) の 1:1 写像（畳み込み ② で使用）。 */
const VARIATION_STATE_BY_APPLICATION_CODE: Record<
  ApplicationStatusCode,
  VariationApplicationState
> = {
  PENDING: VariationApplicationState.PENDING,
  APPROVED: VariationApplicationState.APPROVED,
  REJECTED: VariationApplicationState.REJECTED,
  WITHDRAWN: VariationApplicationState.WITHDRAWN,
};
