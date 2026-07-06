"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/_components/shadcnui/dialog";
import type { PreviewApplicationResultDTO } from "@subdomains/estimate/application/queries/dto/PreviewApplicationResultDTO";
import { formatYen } from "../_shared/labels";
import { previewApplication, submitApplication } from "./actions";

type Props = {
  /** 見積番号（Server Action の束縛・estimateId 再解決に使う）。 */
  estimateNumber: string;
  /** 申請対象バリエーション ID。 */
  variationId: string;
  /** 申請対象の案番号（確認文の表示用）。 */
  variationNumber: number;
  /** 親集約の楽観ロックトークン（ADR-0039）。submit へ client エコーする（version 関門・ADR-0068）。 */
  version: number;
  /** 申請対象バリの税込合計（REQUIRED 表示用・ADR-0055 のゴール判定と同じ税込最終合計）。 */
  finalTotal: number;
  /** 申請可能か（ACTIVE かつ 見積内に前進バリなし・ADR-0069）。トリガーの活性を制御する。 */
  canApply: boolean;
  /** 対象バリの状態（トリガー無効時のツールチップ文言選択に使う。DTO 再発明はしない）。 */
  variationStatus: string;
  /**
   * submit 失敗（競合・業務例外）時にパネルへ持ち上げるコールバック。モーダルは強制クローズし、
   * パネル上部の永続バナーで「最新ではない」旨を告知させる（auto-refresh しない・#494）。
   */
  onSubmitFailure: (message: string) => void;
  /**
   * submit 成功時にパネルへ通知するコールバック。直前の失敗で立った永続バナーを消すために使う
   * （「失敗→再申請成功」でバナーが残り続ける誤表示を防ぐ・#494・自動レビュー R1）。
   */
  onSubmitSuccess?: () => void;
};

/** トリガー無効時のツールチップ文言（無効化は canApply 単一ゲート・文言だけ状態で選ぶ）。 */
function disabledReason(variationStatus: string): string {
  return variationStatus !== "ACTIVE"
    ? "無効なバリエーションは申請できません"
    : "既に前進しているバリエーションがあるため申請できません（1見積1前進）";
}

/**
 * 見積申請の確認モーダル（S2・§6.2/§6.3・#494）。
 *
 * 操作行の「申請」ボタン（トリガー）とモーダルを内包する自己完結コンポーネント。開くと
 * {@link previewApplication} を副作用なしで呼び、結果 `kind` を網羅 switch で描く。この switch 自体が
 * `PreviewApplicationResultDTO` のコンパイル時消費証明を兼ね、DTO に kind が増減すれば never ガードで
 * 型エラーになる（独立スタブとのドリフトを排す・ADR-0069）。
 *
 * - REQUIRED: 承認チェーン（起点→ゴール順）と税込合計を示し「申請する」で {@link submitApplication}。
 * - EXEMPT: 免除理由 label を示し「申請する」（免除の記録も単一ジェスチャ・ADR-0037/0038）。
 * - BLOCKED / INACTIVE: BE 供給の文言のみ描き、確認ボタンは出さない（申請できないため）。
 * - submit 成功はモーダルを閉じ `router.refresh()` でパネル（バッジ・canApply）を最新化する。
 * - submit 失敗（ConflictError / BusinessRuleViolationError）は強制クローズし onSubmitFailure へ
 *   メッセージを渡す。パネルは古い表示のままなので、バナーで更新を促す（auto-refresh しない・#494）。
 * - operator 情報が引けない等の preview エラーは前提条件エラーのためモーダル内に文言を出すに留め、
 *   バナー導線には乗せない。
 */
export function ApplicationConfirmDialog({
  estimateNumber,
  variationId,
  variationNumber,
  version,
  finalTotal,
  canApply,
  variationStatus,
  onSubmitFailure,
  onSubmitSuccess,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewApplicationResultDTO | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();

  function handleOpen(): void {
    setPreview(null);
    setPreviewError(null);
    setOpen(true);
    startPreview(async () => {
      const result = await previewApplication(estimateNumber, variationId);
      if (result.success) {
        setPreview(result.data ?? null);
      } else {
        setPreviewError(result.error ?? "プレビューの取得に失敗しました");
      }
    });
  }

  function handleSubmit(): void {
    startSubmit(async () => {
      const result = await submitApplication(estimateNumber, variationId, version);
      if (result.success) {
        setOpen(false);
        // 直前の失敗で立った永続バナーを消す（成功でパネルは最新化される・#494・R1）。
        onSubmitSuccess?.();
        router.refresh();
      } else {
        // 競合・業務例外は強制クローズしてパネルのバナーへ委譲する（画面全体をユーザーに確認させる）。
        setOpen(false);
        onSubmitFailure(result.error ?? "申請に失敗しました");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={!canApply}
        title={canApply ? undefined : disabledReason(variationStatus)}
        className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-1 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed"
      >
        申請
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>申請の確認</DialogTitle>
            <DialogDescription>
              第{variationNumber}案を申請します。内容を確認してください。
            </DialogDescription>
          </DialogHeader>

          {isPreviewing && <p className="text-gray-600 py-4">プレビューを取得しています...</p>}

          {previewError && (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm"
              role="alert"
            >
              {previewError}
            </div>
          )}

          {preview && (
            <PreviewBody
              preview={preview}
              finalTotal={finalTotal}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** preview の kind を網羅描画する（never ガードで DTO 消費をコンパイル時に証明する・ADR-0069）。 */
function PreviewBody({
  preview,
  finalTotal,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  preview: PreviewApplicationResultDTO;
  finalTotal: number;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  switch (preview.kind) {
    case "REQUIRED":
      return (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">承認チェーン</h3>
            <ol className="space-y-1">
              {preview.steps.map((step) => (
                <li key={step.order} className="text-gray-900">
                  {`${step.order}. ${step.roleName}（${step.positionName}）`}
                </li>
              ))}
            </ol>
            <p className="text-sm text-gray-600 mt-2">最終承認職位: {preview.goalPositionName}</p>
          </div>
          <p className="text-right text-lg font-bold text-gray-900">{formatYen(finalTotal)}</p>
          <ConfirmFooter
            confirmLabel="申請する"
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        </div>
      );
    case "EXEMPT":
      return (
        <div className="space-y-4">
          <p className="bg-green-50 border border-green-300 text-green-800 text-sm px-3 py-2 rounded">
            この申請は承認不要です（理由: {preview.reasonLabel}
            ）。申請すると承認免除として記録されます。
          </p>
          <ConfirmFooter
            confirmLabel="申請する"
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        </div>
      );
    case "BLOCKED":
      return (
        <div className="space-y-4">
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm"
            role="alert"
          >
            {preview.reasonLabel}
          </div>
          <CloseOnlyFooter onCancel={onCancel} />
        </div>
      );
    case "INACTIVE":
      return (
        <div className="space-y-4">
          <div
            className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded text-sm"
            role="alert"
          >
            {preview.label}
          </div>
          <CloseOnlyFooter onCancel={onCancel} />
        </div>
      );
    default: {
      // 網羅漏れ（DTO に kind が増えた等）をコンパイル時に検出する（ADR-0069）。実行時に版スキュー等で
      // 未知 kind が届いても、オブジェクトを React child として返さず null を描く（描画クラッシュ防止・R1）。
      const _exhaustive: never = preview;
      void _exhaustive;
      return null;
    }
  }
}

/** 確認（申請する）＋キャンセルのフッター（EXEMPT / REQUIRED 共用）。 */
function ConfirmFooter({
  confirmLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  confirmLabel: string;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-3 justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:cursor-not-allowed"
      >
        キャンセル
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "申請中..." : confirmLabel}
      </button>
    </div>
  );
}

/** 申請できない分岐（BLOCKED / INACTIVE）の「閉じる」だけのフッター。 */
function CloseOnlyFooter({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
      >
        閉じる
      </button>
    </div>
  );
}
