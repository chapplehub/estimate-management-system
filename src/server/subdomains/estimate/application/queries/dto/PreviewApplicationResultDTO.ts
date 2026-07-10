import { type ApprovalChainBlockedReason } from "@subdomains/estimate/domain/services/approval/ApprovalChainBuilder";

/**
 * 申請可能な preview（EXEMPT/REQUIRED）に添える単価乖離・解決不能の非ブロッキング警告件数（#593）。
 *
 * 対象バリエーションの価格付き末端行を見積年月日基準で再解決・突合した件数（→単価乖離・解決不能）。
 * 申請可否とは直交で、`kind` は増やさない（警告は申請ブロックしない・ADR-20260710-fg7）。0 件なら警告なし。
 */
export type UnitPriceWarningDTO = {
  /** 固定値≠再解決値の明細数（→単価乖離）。 */
  divergentCount: number;
  /** 見積年月日に有効な販売単価が無い明細数（→解決不能）。 */
  unresolvableCount: number;
};

/** 承認チェーンの 1 ステップ（確認モーダル表示用・§6.2）。起点→ゴール順。 */
export type PreviewApplicationStepDTO = {
  /** 1 始まりの順序（起点＝1）。 */
  order: number;
  /** 承認対象役割の名称（例: 営業一課長）。 */
  roleName: string;
  /** その役割の役職名（例: 課長）。 */
  positionName: string;
};

/**
 * 申請プレビューの結果（確認モーダル用・§6.2）。
 *
 * 免除（理由）／承認必要（ゴール役職＋ステップ列）／申請不可（業務理由）／対象バリエーションが
 * 無効（INACTIVE）の判別共用体。副作用は無く、`SubmitApplication` と同じ judge＋組立てロジックを
 * 共有して得る（#417）。
 *
 * `INACTIVE` はチェーン構築以前の「バリエーション状態」の事実で、`BLOCKED`（承認チェーンが
 * 組めない業務理由）とは原因が異なるため専用 kind に分ける。Submit が `targetVariationIsActive`
 * を判定の起点に置くのと同じく、Preview も judge を走らせる前にこれを返す（#442）。
 *
 * 実行不可の3分岐（EXEMPT は確認可・BLOCKED/INACTIVE は不可）の表示文言はすべて BE 所有とし、
 * モーダルは受け取った label をそのまま描く（ADR-0069）。`BLOCKED` は理由 code に対応する
 * `reasonLabel`（{@link BLOCKED_REASON_LABELS} 由来）、`INACTIVE` は code 集合を持たない単一 kind
 * ゆえ `reason` を持たず固定の `label` 単体を載せる。
 */
export type PreviewApplicationResultDTO =
  | { kind: "EXEMPT"; reason: string; reasonLabel: string; unitPriceWarning: UnitPriceWarningDTO }
  | {
      kind: "REQUIRED";
      goalPositionId: string;
      goalPositionName: string;
      steps: PreviewApplicationStepDTO[];
      unitPriceWarning: UnitPriceWarningDTO;
    }
  | { kind: "BLOCKED"; reason: ApprovalChainBlockedReason; reasonLabel: string }
  | { kind: "INACTIVE"; label: string };
