import { type ApprovalChainBlockedReason } from "@subdomains/estimate/domain/services/approval/ApprovalChainBuilder";

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
 */
export type PreviewApplicationResultDTO =
  | { kind: "EXEMPT"; reason: string; reasonLabel: string }
  | {
      kind: "REQUIRED";
      goalPositionId: string;
      goalPositionName: string;
      steps: PreviewApplicationStepDTO[];
    }
  | { kind: "BLOCKED"; reason: ApprovalChainBlockedReason }
  | { kind: "INACTIVE" };
