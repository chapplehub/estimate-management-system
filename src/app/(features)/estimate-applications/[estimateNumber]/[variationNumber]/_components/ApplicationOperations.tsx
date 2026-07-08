"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/_components/shadcnui/dialog";
import type { ApplicationOperationsView } from "@subdomains/estimate/application/queries/dto/EstimateApplicationDetailDTO";
import { approveStep, rejectStep, withdrawApplication } from "../actions";

/** 差戻理由の最大文字数（VO `RejectionComment` の MAX_LENGTH と一致・権威は VO・ADR-0069）。 */
const REJECTION_COMMENT_MAX_LENGTH = 2000;

type Props = {
  /** 操作可否＋コマンド標的（app 層 Query が操作者を受けて合成・ADR-20260707-ae2）。 */
  operations: ApplicationOperationsView;
  /** 対象バリの案番号（確認文の表示用）。 */
  variationNumber: number;
};

/**
 * 見積申請詳細の操作ブロック（承認/差戻/取下・#575）。
 *
 * DTO の 3 フラグ（`canApprove`／`canReject`／`canWithdraw`）でボタンを出し分ける常設クライアント
 * 部品。資格の無い閲覧者には 3 フラグが全 false で渡り、何も描画しない（純粋な閲覧画面）。承認/差戻は
 * 同一述語（当該ステップの役割メンバー）で `awaitingStepId`＋`expectedVersion` を標的に、取下は
 * `latestApplicationId`＋`expectedVersion` を標的に取る。FE の出し分けは UX のためで、最終防衛は BE
 * （役割メンバー検証・本人性検証・楽観ロック）。
 *
 * 成功/失敗の提示方針:
 * - 成功: sonner `toast.success` を直接呼び `router.refresh()` で RSC を再導出（#562 申請ボタンモデル）。
 *   承認は outcome（最終承認/途中承認）で文言を分ける。
 * - 失敗（入力保護で分岐）: 承認/取下（入力なし）はダイアログを閉じエラートースト＋refresh で真実へ。
 *   差戻（コメントあり）はダイアログを保持し内部にエラー表示・入力を温存・refresh しない。
 */
export function ApplicationOperations({ operations, variationNumber }: Props) {
  const {
    canApprove,
    canReject,
    canWithdraw,
    latestApplicationId,
    awaitingStepId,
    expectedVersion,
  } = operations;

  // 3 フラグ全 false（資格なし・免除・非 PENDING）では操作ブロックごと描画しない。
  if (!canApprove && !canReject && !canWithdraw) {
    return null;
  }

  return (
    <section className="flex flex-wrap gap-3" aria-label="申請操作">
      {canApprove && awaitingStepId !== null && expectedVersion !== null && (
        <ApproveDialog
          variationNumber={variationNumber}
          stepId={awaitingStepId}
          expectedVersion={expectedVersion}
        />
      )}
      {canReject && awaitingStepId !== null && expectedVersion !== null && (
        <RejectDialog
          variationNumber={variationNumber}
          stepId={awaitingStepId}
          expectedVersion={expectedVersion}
        />
      )}
      {canWithdraw && latestApplicationId !== null && expectedVersion !== null && (
        <WithdrawDialog
          variationNumber={variationNumber}
          applicationId={latestApplicationId}
          expectedVersion={expectedVersion}
        />
      )}
    </section>
  );
}

/** 承認の確認ダイアログ（確定/キャンセル・入力なし）。 */
function ApproveDialog({
  variationNumber,
  stepId,
  expectedVersion,
}: {
  variationNumber: number;
  stepId: string;
  expectedVersion: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, startSubmit] = useTransition();

  function handleConfirm(): void {
    startSubmit(async () => {
      const result = await approveStep(stepId, expectedVersion);
      if (result.success) {
        setOpen(false);
        // 途中承認は refresh 後もバッジが「申請中」のまま。文言で結果を言い切り不安を消す。
        const message =
          result.data?.outcome === "APPROVED"
            ? "承認しました。この申請は承認済になりました"
            : "承認しました。次の承認ステップに進みました";
        toast.success(message);
        router.refresh();
      } else {
        // 入力なしのため画面を最新へ寄せる（強制クローズ＋エラートースト＋refresh）。
        setOpen(false);
        toast.error(result.error ?? "承認に失敗しました");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TriggerButton
        onClick={() => setOpen(true)}
        className="bg-green-600 hover:bg-green-700"
        label="承認"
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>承認の確認</DialogTitle>
          <DialogDescription>第{variationNumber}案を承認します。よろしいですか？</DialogDescription>
        </DialogHeader>
        <ConfirmFooter
          confirmLabel="承認する"
          submittingLabel="承認中..."
          isSubmitting={isSubmitting}
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * 差戻のコメント入力ダイアログ。コメント `useState` は本コンポーネント本体（DialogContent の外）に
 * 持つため、閉じて再度開いても入力が残る。差戻成功時は refresh → RSC 再評価で canReject=false となり
 * 本コンポーネントごと unmount され、入力が自然にクリアされる（成功時のみクリア）。失敗時はダイアログ
 * を保持し、コメントを温存する（入力保護・auto-refresh しない）。
 */
function RejectDialog({
  variationNumber,
  stepId,
  expectedVersion,
}: {
  variationNumber: number;
  stepId: string;
  expectedVersion: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  // 権威は VO `RejectionComment`（必須・1〜2000字・trim）。FE はミラーせず UX ガードに留める。
  const trimmedEmpty = comment.trim().length === 0;

  function handleConfirm(): void {
    setError(null);
    startSubmit(async () => {
      const result = await rejectStep(stepId, comment, expectedVersion);
      if (result.success) {
        // クローズしても comment は残すが、成功は refresh で操作ブロックごと消えるため気にしない。
        setOpen(false);
        toast.success("差し戻しました");
        router.refresh();
      } else {
        // 入力保護: ダイアログを開いたまま内部にエラーを出し、コメントを温存する（refresh しない）。
        setError(result.error ?? "差戻に失敗しました");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TriggerButton
        onClick={() => setOpen(true)}
        className="bg-orange-600 hover:bg-orange-700"
        label="差戻"
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>差戻の確認</DialogTitle>
          <DialogDescription>
            第{variationNumber}案を差し戻します。差戻理由を入力してください。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <textarea
            aria-label="差戻理由"
            value={comment}
            maxLength={REJECTION_COMMENT_MAX_LENGTH}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="差戻理由を入力（必須）"
          />
          <p className="text-right text-xs text-gray-500">
            {comment.length} / {REJECTION_COMMENT_MAX_LENGTH}
          </p>
        </div>

        {error && (
          <div
            className="rounded border border-red-400 bg-red-100 px-4 py-2 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <ConfirmFooter
          confirmLabel="差し戻す"
          submittingLabel="差戻中..."
          isSubmitting={isSubmitting}
          confirmDisabled={trimmedEmpty}
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** 取下の確認ダイアログ（確定/キャンセル・入力なし）。 */
function WithdrawDialog({
  variationNumber,
  applicationId,
  expectedVersion,
}: {
  variationNumber: number;
  applicationId: string;
  expectedVersion: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, startSubmit] = useTransition();

  function handleConfirm(): void {
    startSubmit(async () => {
      const result = await withdrawApplication(applicationId, expectedVersion);
      if (result.success) {
        setOpen(false);
        toast.success("取り下げました");
        router.refresh();
      } else {
        setOpen(false);
        toast.error(result.error ?? "取下に失敗しました");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TriggerButton
        onClick={() => setOpen(true)}
        className="bg-gray-600 hover:bg-gray-700"
        label="取下"
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>取下の確認</DialogTitle>
          <DialogDescription>
            第{variationNumber}案を取り下げます。よろしいですか？
          </DialogDescription>
        </DialogHeader>
        <ConfirmFooter
          confirmLabel="取り下げる"
          submittingLabel="取下中..."
          isSubmitting={isSubmitting}
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** 操作トリガー（各操作で色だけ変える共通ボタン）。 */
function TriggerButton({
  onClick,
  className,
  label,
}: {
  onClick: () => void;
  className: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} rounded px-4 py-1 text-sm font-bold text-white focus:outline-none focus:shadow-outline`}
    >
      {label}
    </button>
  );
}

/** 確認（確定）＋キャンセルのフッター（3 ダイアログ共用）。 */
function ConfirmFooter({
  confirmLabel,
  submittingLabel,
  isSubmitting,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: {
  confirmLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="rounded bg-gray-300 px-4 py-2 font-bold text-gray-800 hover:bg-gray-400 focus:outline-none focus:shadow-outline disabled:cursor-not-allowed"
      >
        キャンセル
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isSubmitting || confirmDisabled}
        className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700 focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isSubmitting ? submittingLabel : confirmLabel}
      </button>
    </div>
  );
}
