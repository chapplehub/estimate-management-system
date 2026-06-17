"use client";

import { useState } from "react";
import {
  expandSetComponents,
  getProductLineSnapshot,
  getProductSuggestions,
  type SuggestedProduct,
} from "../_shared/selection-actions";
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

type UseVariationLineEditorParams = {
  /** 初期作業ノード（複製元 DTO 由来／新規追加は空配列／編集は閲覧 DTO 由来）。供給元はラッパが解決する。 */
  initialNodes: WorkingNode[];
  /** 初期全体値引（複製・編集は引き継ぎ、新規追加は 0）。 */
  initialOverallDiscount: number;
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
  taxRate,
  taxRoundingType,
}: UseVariationLineEditorParams) {
  const [nodes, setNodes] = useState<WorkingNode[]>(() => initialNodes);
  const [overallDiscount, setOverallDiscount] = useState(initialOverallDiscount);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  // 本体追加直後の周辺商品サジェスト（提案あり時のみ）。挿入は本体行（mainRowId）の直下。
  const [suggestState, setSuggestState] = useState<SuggestState | null>(null);

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

  // 商品選択: セット商品なら構成を自動展開して群ノードを挿入、通常商品ならスナップショット解決して
  // 通常行を挿入する。挿入位置はアクティブノード直下（構成/群がアクティブなら群の直後＝トップレベル）。
  const handleProductSelect = async (rows: ProductSelectionRow[]) => {
    const picked = rows[0];
    if (!picked) return;

    if (picked.category === "SET") {
      const expanded = await expandSetComponents(picked.id);
      if (!expanded) return;
      const groupRowId = crypto.randomUUID();
      const group = createWorkingSetGroup(groupRowId, expanded, () => crypto.randomUUID());
      setNodes((prev) => insertNodesBelow(prev, activeRowId, [group]));
      setActiveRowId(groupRowId);
      // セット商品は周辺商品サジェストの対象外（構成は自動展開で確定）。
      return;
    }

    const snapshot = await getProductLineSnapshot(picked.id);
    if (!snapshot) return;
    const newLine = createWorkingLine(crypto.randomUUID(), snapshot);
    setNodes((prev) => insertNodesBelow(prev, activeRowId, [newLine]));
    setActiveRowId(newLine.rowId);

    const suggestions = await getProductSuggestions(snapshot.id);
    if (suggestions.length > 0) {
      setSuggestState({ mainRowId: newLine.rowId, mainName: snapshot.name, suggestions });
    }
  };

  // 提案された周辺商品（選択分）を本体直下に通常行として挿入する（数量＝relation・他は新規行既定）。
  const confirmSuggestions = (selected: SuggestedProduct[]) => {
    if (!suggestState) return;
    const peripheralLines = selected.map((s) =>
      createWorkingLine(crypto.randomUUID(), s, { quantity: s.quantity })
    );
    setNodes((prev) => insertNodesBelow(prev, suggestState.mainRowId, peripheralLines));
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
    totals,
    changeLine,
    deleteNode,
    reorderTopLevel,
    reorderInGroup,
    handleProductSelect,
    confirmSuggestions,
  };
}

export type VariationLineEditor = ReturnType<typeof useVariationLineEditor>;
