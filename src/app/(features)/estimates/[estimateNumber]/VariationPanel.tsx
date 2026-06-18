"use client";

import { useState } from "react";
import { Badge } from "@/app/_components/shadcnui/badge";
import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { SUBMISSION_TYPE_LABELS, formatYen } from "../_shared/labels";
import { LineTable } from "./components/LineTable";
import {
  isVariationDuplicatable,
  isVariationEditable,
  isVariationRevisableForCustomer,
} from "./variationEditable";
import { VariationEditForm } from "./VariationEditForm";
import { VariationMemoEditForm } from "./VariationMemoEditForm";
import { VariationCreateForm } from "./VariationCreateForm";
import { ReviseForCustomerDialog } from "./ReviseForCustomerDialog";
import {
  toCreateInitialValuesFromVariation,
  type VariationCreateInitialValues,
} from "./variationDuplication";

type Props = {
  estimateNumber: string;
  /** 集約ルートの楽観ロックトークン（ADR-0039）。編集フォームへ往復させる。 */
  version: number;
  variations: VariationDTO[];
  /** 消費税率（金額プレビュー用・見積時点スナップショット）。 */
  taxRate: number;
  /** 税端数区分（金額プレビュー用）。 */
  taxRoundingType: string;
  /**
   * この見積に既に改訂系譜が存在するか（top-level・ADR-0049）。得意先改訂の確認モーダルが
   * 初回改訂か（＝ヘッダーロック告知の要否）を判断するために引き回す。
   */
  hasRevision: boolean;
};

/**
 * パネルのモード（閲覧／編集／新規追加／複製）。`isEditing` と `creating` の 2 state を 1 つの
 * 判別共用体へ統合し、排他性を型で担保する（複製と新規追加は initialValues の有無ではなくタグで
 * 区別）。判別子は既存の作業ノード（{@link variationLines} の `kind`）・スキーマと語彙を揃え `kind`。
 * `activeIndex`／`activeRowId`（どのタブ・どの行か）はモードと直交する関心事なので含めない。
 */
type PanelMode =
  | { kind: "view" }
  | { kind: "edit" }
  | { kind: "edit-memo" }
  | { kind: "create-new" }
  | { kind: "create-duplicate"; initialValues: VariationCreateInitialValues };

/**
 * バリエーションパネル（④〜⑨・クライアントアイランド）。
 *
 * 閲覧（S2）と内容編集（S4 / C4）をタブ単位で切り替える。編集はアクティブなバリ1件のみ・
 * ヘッダー編集（C2）とは独立したトグル。編集できるのは「セット群なし・非改訂・有効」バリに
 * 限る（C4 はセット群を表現できないため・計画§1）。最終強制はドメイン、UI 抑止は二重防御の外側。
 * 編集中のタブ切替は未保存の作業コピーが消えるため破棄確認する。
 */
export function VariationPanel({
  estimateNumber,
  version,
  variations,
  taxRate,
  taxRoundingType,
  hasRevision,
}: Props) {
  // 既定タブ＝最小番号の ACTIVE バリ（全 INACTIVE なら最小番号）。variations は番号昇順。
  const firstActive = variations.findIndex((v) => v.status === "ACTIVE");
  const [activeIndex, setActiveIndex] = useState(firstActive >= 0 ? firstActive : 0);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  // 閲覧／編集（C4）／新規追加・複製（C3）を 1 つの判別共用体で排他管理する（計画§起点）。
  const [mode, setMode] = useState<PanelMode>({ kind: "view" });

  const allInactive = variations.every((v) => v.status !== "ACTIVE");
  const active = variations[activeIndex];

  function selectVariation(index: number): void {
    if (index === activeIndex) return;
    // 編集・作成中のタブ切替は未保存の作業コピーが消えるため破棄確認（計画§2）。
    if (
      mode.kind !== "view" &&
      !window.confirm("編集中の内容は破棄されます。タブを切り替えますか？")
    ) {
      return;
    }
    setMode({ kind: "view" });
    setActiveIndex(index);
    setActiveRowId(null); // タブ切替で行アクティブをリセット
  }

  function startDuplicate(): void {
    setActiveRowId(null);
    setMode({
      kind: "create-duplicate",
      initialValues: toCreateInitialValuesFromVariation(active),
    });
  }

  function startNew(): void {
    setActiveRowId(null);
    setMode({ kind: "create-new" });
  }

  return (
    <div>
      {/* 全無効警告（presentation 導出。DTO に専用フラグは持たせない） */}
      {allInactive && (
        <div
          role="alert"
          className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4"
        >
          すべてのバリエーションが無効です。
        </div>
      )}

      {/* ④ タブ（無効はグレーアウト＋取消線） */}
      <div role="tablist" aria-label="バリエーション" className="flex gap-1 border-b mb-4">
        {variations.map((v, i) => {
          const isInactive = v.status !== "ACTIVE";
          const isSelected = i === activeIndex;
          return (
            <button
              key={v.variationId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => selectVariation(i)}
              className={[
                "px-4 py-2 -mb-px border-b-2 transition-colors",
                isSelected
                  ? "border-blue-500 font-bold text-blue-700"
                  : "border-transparent text-gray-600 hover:text-gray-900",
                isInactive ? "text-gray-400 line-through" : "",
              ].join(" ")}
            >
              バリエーション{v.variationNumber}
            </button>
          );
        })}
      </div>

      {active && (
        <div>
          {/* ⑤ 操作行（提出区分バッジ・状態インジケータ・編集／複製／追加トグル） */}
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="outline">
              {SUBMISSION_TYPE_LABELS[active.submissionType] ?? active.submissionType}
            </Badge>
            <span className="text-sm text-gray-600">
              {active.status === "ACTIVE" ? "● 有効" : "○ 無効"}
            </span>
            {mode.kind === "view" && (
              <div className="ml-auto flex gap-2">
                {isVariationEditable(active) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRowId(null);
                      setMode({ kind: "edit" });
                    }}
                    className="bg-blue-500 hover:bg-blue-700 text-white text-sm font-bold py-1 px-4 rounded"
                  >
                    内容を編集
                  </button>
                )}
                {/* 改訂元（凍結）はメモ以外編集不可。メモのみ編集を専用ボタンで出す（ADR-0059）。 */}
                {active.revisionRole === "REVISION_SOURCE" && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRowId(null);
                      setMode({ kind: "edit-memo" });
                    }}
                    className="bg-blue-500 hover:bg-blue-700 text-white text-sm font-bold py-1 px-4 rounded"
                  >
                    メモを編集
                  </button>
                )}
                {/* 複製は「改訂明細を含まない」バリのみ（状態不問・改訂先タブでは非表示）。 */}
                {isVariationDuplicatable(active) && (
                  <button
                    type="button"
                    onClick={startDuplicate}
                    className="bg-indigo-500 hover:bg-indigo-700 text-white text-sm font-bold py-1 px-4 rounded"
                  >
                    複製
                  </button>
                )}
                {/* 得意先改訂は「納品先宛・有効」バリのみ（C7・ドメイン2ガードの写し）。確認モーダルは
                    PanelMode と直交した自己完結コンポーネント（開閉 state はダイアログ内に閉じる）。 */}
                {isVariationRevisableForCustomer(active) && (
                  <ReviseForCustomerDialog
                    estimateNumber={estimateNumber}
                    version={version}
                    sourceVariationId={active.variationId}
                    sourceVariationNumber={active.variationNumber}
                    hasRevision={hasRevision}
                  />
                )}
                <button
                  type="button"
                  onClick={startNew}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-1 px-4 rounded"
                >
                  ＋バリエーション追加
                </button>
              </div>
            )}
          </div>

          {mode.kind === "create-new" || mode.kind === "create-duplicate" ? (
            <VariationCreateForm
              {...(mode.kind === "create-duplicate"
                ? { kind: "duplicate" as const, initialValues: mode.initialValues }
                : { kind: "new" as const })}
              estimateNumber={estimateNumber}
              version={version}
              taxRate={taxRate}
              taxRoundingType={taxRoundingType}
              onCancel={() => setMode({ kind: "view" })}
            />
          ) : mode.kind === "edit" ? (
            <VariationEditForm
              estimateNumber={estimateNumber}
              version={version}
              variation={active}
              taxRate={taxRate}
              taxRoundingType={taxRoundingType}
              onCancel={() => setMode({ kind: "view" })}
            />
          ) : mode.kind === "edit-memo" ? (
            <VariationMemoEditForm
              estimateNumber={estimateNumber}
              version={version}
              variation={active}
              onCancel={() => setMode({ kind: "view" })}
            />
          ) : (
            <ReadOnlyVariationBody
              variation={active}
              activeRowId={activeRowId}
              onSelectRow={setActiveRowId}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** 閲覧モードの ⑥明細・⑦全体値引・⑧メモ・⑨金額サマリー（read-only）。 */
function ReadOnlyVariationBody({
  variation,
  activeRowId,
  onSelectRow,
}: {
  variation: VariationDTO;
  activeRowId: string | null;
  onSelectRow: (id: string) => void;
}) {
  return (
    <div>
      {/* ⑥ 明細テーブル */}
      <LineTable lines={variation.lines} activeRowId={activeRowId} onSelectRow={onSelectRow} />

      {/* ⑦ 全体値引 */}
      {variation.overallDiscount > 0 && (
        <div className="mt-4 text-right text-sm text-gray-700">
          全体値引: -{formatYen(variation.overallDiscount)}
        </div>
      )}

      {/* ⑧ メモ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <MemoBlock label="顧客メモ" value={variation.customerMemo} />
        <MemoBlock label="社内メモ" value={variation.internalMemo} />
      </div>

      {/* ⑨ 金額サマリー（選択中バリの永続集計・ADR-0033。バリは代替・合算しない） */}
      <div className="mt-6 flex justify-end">
        <dl className="w-full md:w-80 space-y-1 text-sm">
          <SummaryRow label="小計" value={variation.subtotal} />
          <SummaryRow label="税抜合計" value={variation.finalSubtotal} />
          <SummaryRow label="消費税" value={variation.taxAmount} />
          <SummaryRow label="合計" value={variation.finalTotal} emphasize />
        </dl>
      </div>
    </div>
  );
}

function MemoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 mb-1">{label}</h3>
      <p className="text-gray-900 whitespace-pre-wrap min-h-6">{value || "—"}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={[
        "flex justify-between py-1",
        emphasize ? "border-t pt-2 text-lg font-bold text-gray-900" : "text-gray-700",
      ].join(" ")}
    >
      <dt>{label}</dt>
      <dd>{formatYen(value)}</dd>
    </div>
  );
}
