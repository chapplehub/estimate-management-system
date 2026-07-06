import { type VariationApplicationStateCode } from "@subdomains/estimate/domain/values/approval/VariationApplicationState";

/**
 * バリエーション申請状態の code 集合（6値）を境界へ再輸出する（ADR-0069）。
 *
 * 単一ソースはドメイン VO（{@link VariationApplicationState}）。FE はこの application 境界の
 * ファイルから DTO と code 型を直 type-import で消費し、ドメイン層へ直接手を伸ばさない
 * （ミラー型を作らない・ADR-0069）。
 */
export type { VariationApplicationStateCode };

/**
 * バリエーション別 申請状態の読み取り DTO（見積詳細画面 S2・#493・#491 で合意）。
 *
 * 見積詳細画面の「申請ボタン出し分け」と「バリエーション別バッジ」を駆動する。1 行 =
 * バリエーション1件で、`GetVariationApplicationStatesQuery` が見積配下の全バリエーション
 * （INACTIVE 含む）を variationNumber 昇順で返す。集約再構築を経ず Prisma を直読みして
 * 組み立てる（CQRS read model）。
 */
export type VariationApplicationStateDTO = {
  variationId: string;
  /**
   * 現在の申請状態（バッジ表示用）。`code` は VO 単一ソースの6値（ADR-0069）、`label` は
   * VO が持つ正準文言（重なる4値は申請 VO へ委譲・NONE=未申請・EXEMPTED=承認不要）。
   */
  applicationState: {
    code: VariationApplicationStateCode;
    label: string;
  };
  /**
   * このバリエーションへ今から申請できるか（申請ボタンの出し分け）。
   * `canApply = バリエーションが ACTIVE かつ 見積内に前進バリエーションが無い`。
   * INACTIVE は false。承認チェーン構築可否（BLOCKED）は含めない＝preview 専任（#493）。
   */
  canApply: boolean;
};
