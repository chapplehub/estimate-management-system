"use client";

import { useState } from "react";
import { callReadAction } from "@/app/_lib/callReadAction";
import {
  SELECTION_ABORTED,
  type SelectionAborted,
  type SelectionRejection,
} from "@/app/_components/shared/SelectionModal";
import {
  expandSetComponents,
  getProductLineSnapshot,
  getProductSuggestions,
  type ProductLineSnapshot,
  type SuggestedProduct,
} from "../_shared/selection-actions";
import type { ExpandedSetGroup } from "../_shared/setComponentExpansion";
import { resolveSellingPricesForDisplay } from "../_shared/selling-price-actions";
import type { ProductSelectionRow } from "../_shared/selectionColumns";
import { previewVariationTotals, type PreviewTotals } from "./previewAmounts";
import {
  changeNodeLine,
  createWorkingLine,
  createWorkingSetGroup,
  flattenPricedLines,
  insertNodesBelow,
  removeNode,
  reorderComponents,
  reorderNodes,
  type WorkingLine,
  type WorkingNode,
} from "./variationLines";

type SuggestState = {
  mainRowId: string;
  mainName: string;
  suggestions: SuggestedProduct[];
};

/**
 * 選択行1件の解決結果（相1）。原子的な拒否には全件の解決完了が前提のため、取得と検証を分ける。
 * 拒否時の `invalidIds` に載せる ID は**選択行の ID**（セットは構成ではなくセット商品の ID）。
 */
type PreparedSelection =
  | { kind: "set"; row: ProductSelectionRow; expanded: ExpandedSetGroup }
  | { kind: "product"; row: ProductSelectionRow; snapshot: ProductLineSnapshot };

/**
 * 明細追加時に見積単価を価格決定（#428・ADR-0064）へ問い合わせるための宛先コンテキスト。
 * 提出区分は宛先の判別に使い、`estimateDate` は "yyyy-mm-dd"（表示解決 Server Action の契約）。
 * C1/C3 新規は提出区分・宛先・見積年月日がフォーム内で変動するため、ラッパが最新値を毎レンダー渡す
 * （選択時点の値で解決し、後からの変更に表示単価は追従しない＝保存時にサーバが権威解決・計画の許容中間状態）。
 */
export type LineEditorPriceContext = {
  estimateDate: string;
  customerId: string;
  deliveryLocationId: string;
  submissionType: string;
};

type UseVariationLineEditorParams = {
  /** 初期作業ノード（複製元 DTO 由来／新規追加は空配列／編集は閲覧 DTO 由来）。供給元はラッパが解決する。 */
  initialNodes: WorkingNode[];
  /** 初期全体値引（複製・編集は引き継ぎ、新規追加は 0）。 */
  initialOverallDiscount: number;
  /** 明細追加時の見積単価解決に使う宛先コンテキスト（提出区分・宛先ID・見積年月日）。 */
  priceContext: LineEditorPriceContext;
  taxRate: number;
  taxRoundingType: string;
};

/**
 * バリ明細編集器の作業コピー（C3 追加／C4 編集で共通）。明細はモーダル選択・インライン編集・D&D で
 * client state が真実になるため、ノード union（通常明細／セット群・ADR-0047）と全体値引を React state
 * で保持し、submit 時にラッパが単一 hidden へ JSON 化して往復する（往復形状 A・ADR-0050）。金額は概算
 * ライブプレビューのみここで導出（確定はドメイン・ADR-0033）。初期値は解決済みプリミティブで注入し、
 * フックは閲覧 DTO / 複製初期値 DTO の形状に依存しない（供給元差はラッパに閉じる）。
 */
export function useVariationLineEditor({
  initialNodes,
  initialOverallDiscount,
  priceContext,
  taxRate,
  taxRoundingType,
}: UseVariationLineEditorParams) {
  const [nodes, setNodes] = useState<WorkingNode[]>(() => initialNodes);
  const [overallDiscount, setOverallDiscount] = useState(initialOverallDiscount);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  // 明細行の「周辺追加」ボタンで開く周辺商品サジェスト（#619・提案が1件以上のときのみ非 null）。
  // 挿入は本体行（mainRowId）の直下。
  const [suggestState, setSuggestState] = useState<SuggestState | null>(null);
  // 周辺商品サジェストで販売単価が解決できずスキップした商品の通知（ADR-0064: 0円明細を作らない）。
  // 商品選択モーダル経由の拒否はモーダル内に表示するため、ここには載らない（#618・ADR-20260716-r4d）。
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // 選択商品群の見積単価を価格決定でライブ解決する（提出区分→宛先へマップ・解決不能は null）。
  // 非業務例外（DB 障害等）は callReadAction が toast + reportError に集約し `undefined` を返す
  // （ADR-20260723-h7r）。呼び出し側 2 箇所はこの `undefined` を見て操作を中断する。
  const resolvePricesFor = (
    productIds: string[]
  ): Promise<Record<string, number | null> | undefined> => {
    const addressee =
      priceContext.submissionType === "DELIVERY_LOCATION" ? "DELIVERY_LOCATION" : "CUSTOMER";
    const addresseeId =
      addressee === "DELIVERY_LOCATION" ? priceContext.deliveryLocationId : priceContext.customerId;
    return callReadAction(
      () =>
        resolveSellingPricesForDisplay({
          estimateDate: priceContext.estimateDate,
          addressee,
          addresseeId,
          productIds,
        }),
      "resolveSellingPricesForDisplay"
    );
  };

  // 金額プレビューは価格付き末端行（通常明細＋全構成）のフラット列で計算する（群は価格を持たない）。
  const totals: PreviewTotals = previewVariationTotals({
    lines: flattenPricedLines(nodes),
    overallDiscount,
    taxRate,
    taxRoundingType,
  });

  const changeLine = (rowId: string, patch: Partial<WorkingLine>) => {
    setNodes((prev) => changeNodeLine(prev, rowId, patch));
  };

  const deleteNode = (rowId: string) => {
    setNodes((prev) => removeNode(prev, rowId));
    if (activeRowId === rowId) setActiveRowId(null);
  };

  const reorderTopLevel = (from: number, to: number) => {
    setNodes((prev) => reorderNodes(prev, from, to));
  };

  const reorderInGroup = (groupRowId: string, from: number, to: number) => {
    setNodes((prev) => reorderComponents(prev, groupRowId, from, to));
  };

  // 商品選択（複数可・#618）: セット商品なら構成を自動展開して群ノードを、通常商品ならスナップショット
  // 解決して通常行を作る。見積単価は価格決定でライブ解決し、**1件でも解決不能なら1件も追加せず拒否**
  // する（ADR-0064: 0円明細を作らない、の一括版）。拒否は SelectionRejection を返してモーダル側に
  // 委ね、ユーザーが原因商品のチェックだけ外して再確定できるようにする（ADR-20260716-r4d）。
  // 挿入位置はアクティブノード直下（構成/群がアクティブなら群の直後＝トップレベル）。
  const handleProductSelect = async (
    rows: ProductSelectionRow[]
  ): Promise<void | SelectionRejection | SelectionAborted> => {
    if (rows.length === 0) return;

    // 相1: 選択行ごとに展開/スナップショットを並列取得する（一括選択は数件〜十数件のため
    // 一括版 Server Action は設けず既存の単体 Action を並列で叩く）。
    // `undefined` = 非業務例外による取得失敗（callReadAction が捕捉）、`null` = 業務上の不在
    // （並行削除等）。この 2 つは失敗時の振る舞いが違うため、集約前にここで区別しておく。
    const prepared = await Promise.all(
      rows.map(async (row): Promise<PreparedSelection | null | undefined> => {
        if (row.category === "SET") {
          const expanded = await callReadAction(
            () => expandSetComponents(row.id),
            "expandSetComponents"
          );
          if (expanded === undefined) return undefined;
          return expanded ? { kind: "set", row, expanded } : null;
        }
        const snapshot = await callReadAction(
          () => getProductLineSnapshot(row.id),
          "getProductLineSnapshot"
        );
        if (snapshot === undefined) return undefined;
        return snapshot ? { kind: "product", row, snapshot } : null;
      })
    );
    // 非業務例外での取得失敗は選択操作を中断する。モーダルは閉じず選択状態も保つため、ユーザーは
    // そのまま再確定でリトライできる（操作中断・state 凍結・#633）。通知は callReadAction の toast。
    if (prepared.some((item) => item === undefined)) return SELECTION_ABORTED;
    // 取得できない商品が混ざったら（並行削除等）何も追加しない（単一選択時の従来の no-op と同義）。
    if (prepared.some((item) => item === null)) return;
    const items = prepared as PreparedSelection[];

    // 相2: 通常商品＋全セット構成の商品 ID を集約し、価格解決は1往復に集約する。
    const productIds = items.flatMap((item) =>
      item.kind === "set" ? item.expanded.components.map((c) => c.productId) : [item.snapshot.id]
    );
    const prices = await resolvePricesFor([...new Set(productIds)]);
    // 価格解決が非業務例外で失敗したら選択操作全体を中断し、1ノードも挿入しない（#633）。
    // 解決不能（業務: 有効な販売単価が無い）とは区別し、拒否メッセージも出さない（toast と二重になるため）。
    if (prices === undefined) return SELECTION_ABORTED;

    // 相3: 検証。`== null` で undefined（見積年月日未入力時の空マップ）も解決不能として拾う。
    // 1件でも不能なら1ノードも挿入せず、原因の選択行 ID と理由を返す。
    const invalidIds: string[] = [];
    const reasons: string[] = [];
    for (const item of items) {
      if (item.kind === "set") {
        const unresolved = item.expanded.components.filter((c) => prices[c.productId] == null);
        if (unresolved.length > 0) {
          const names = [...new Set(unresolved.map((c) => c.name))];
          invalidIds.push(item.row.id);
          // セット構成はモーダルの一覧に現れないため、行の色だけでは原因が分からない。構成名を出す。
          reasons.push(`セット「${item.expanded.name}」の構成商品: ${names.join("、")}`);
        }
        continue;
      }
      if (prices[item.snapshot.id] == null) {
        invalidIds.push(item.row.id);
        reasons.push(`「${item.snapshot.name}」`);
      }
    }
    if (invalidIds.length > 0) {
      return {
        message: `次の商品に有効な販売単価が無いため追加できません（チェックを外して再度お試しください）: ${reasons.join(" / ")}`,
        invalidIds,
      };
    }

    // 相4: 全件解決できたのでノードを構築し、1回の setNodes で表示順のまま1ブロックとして挿入する。
    const newNodes: WorkingNode[] = items.map((item) =>
      item.kind === "set"
        ? createWorkingSetGroup(
            crypto.randomUUID(),
            item.expanded,
            () => crypto.randomUUID(),
            (productId) => prices[productId]!
          )
        : createWorkingLine(crypto.randomUUID(), item.snapshot, {
            unitPrice: prices[item.snapshot.id]!,
          })
    );
    const lastNode = newNodes[newNodes.length - 1]!;
    setSelectionError(null);
    setNodes((prev) => insertNodesBelow(prev, activeRowId, newNodes));
    // 最後の1件をアクティブにすると、続けて追加したぶんが下へ積まれる（「さっき足した続きに足す」）。
    setActiveRowId(lastNode.rowId);
  };

  // 明細行の「周辺追加」ボタン契機で周辺商品サジェストを開く（#619・自動割り込みを廃止）。
  // 現在マスタの周辺（有効フィルタ済み）を getProductSuggestions で引き、≥1 件のときだけダイアログを
  // 開く（suggestState は「必ず中身がある」不変を保つ）。0 件なら開かず selectionError に一言出す
  // （空モーダルの無駄足を避ける）。mainName は対象行の itemName（トップレベル通常明細）から引く。
  const requestSuggestions = async (rowId: string, productId: string) => {
    const mainName = nodes.find((n) => n.kind === "line" && n.rowId === rowId)?.itemName ?? "";
    const suggestions = await callReadAction(
      () => getProductSuggestions(productId),
      "getProductSuggestions"
    );
    // 非業務例外での取得失敗はダイアログを開かず終了する。selectionError は触らない
    // （callReadAction の toast と二重表示になるため・#633）。
    if (suggestions === undefined) return;
    if (suggestions.length === 0) {
      setSelectionError("有効な周辺商品がありません");
      return;
    }
    setSelectionError(null);
    setSuggestState({ mainRowId: rowId, mainName, suggestions });
  };

  // 提案された周辺商品（選択分）を本体直下に通常行として挿入する（数量＝relation・他は新規行既定）。
  // 各商品の見積単価を解決し、解決可能な商品のみ追加する。解決不能な商品はスキップして列挙する
  // （本体は既に追加済みのため、周辺のみ部分的に取りこぼしても操作全体は破棄しない）。
  const confirmSuggestions = async (selected: SuggestedProduct[]) => {
    if (!suggestState) return;
    const prices = await resolvePricesFor(selected.map((s) => s.id));
    // 非業務例外での失敗時は行を挿入せず、サジェストダイアログを開いたまま残す（#633）。
    // suggestState を保つことで、同じ選択のまま再確定してリトライできる。
    if (prices === undefined) return;
    const resolvable = selected.filter((s) => prices[s.id] != null);
    const unresolvable = selected.filter((s) => prices[s.id] == null);

    const peripheralLines = resolvable.map((s) =>
      createWorkingLine(crypto.randomUUID(), s, { quantity: s.quantity, unitPrice: prices[s.id]! })
    );
    if (peripheralLines.length > 0) {
      setNodes((prev) => insertNodesBelow(prev, suggestState.mainRowId, peripheralLines));
    }
    setSelectionError(
      unresolvable.length > 0
        ? `次の商品は有効な販売単価が無いため追加をスキップしました: ${[
            ...new Set(unresolvable.map((s) => s.name)),
          ].join("、")}`
        : null
    );
    setSuggestState(null);
  };

  return {
    nodes,
    overallDiscount,
    setOverallDiscount,
    activeRowId,
    setActiveRowId,
    productModalOpen,
    setProductModalOpen,
    suggestState,
    setSuggestState,
    selectionError,
    setSelectionError,
    totals,
    changeLine,
    deleteNode,
    reorderTopLevel,
    reorderInGroup,
    handleProductSelect,
    requestSuggestions,
    confirmSuggestions,
  };
}

export type VariationLineEditor = ReturnType<typeof useVariationLineEditor>;
