"use client";

import { useState } from "react";
import {
  expandSetComponents,
  getProductLineSnapshot,
  getProductSuggestions,
  type SuggestedProduct,
} from "../_shared/selection-actions";
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
  // 本体追加直後の周辺商品サジェスト（提案あり時のみ）。挿入は本体行（mainRowId）の直下。
  const [suggestState, setSuggestState] = useState<SuggestState | null>(null);
  // 販売単価が解決できず追加を拒否したときのエラー文言（ADR-0064: 0円明細を作らず操作を拒否）。
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // 選択商品群の見積単価を価格決定でライブ解決する（提出区分→宛先へマップ・解決不能は null）。
  const resolvePricesFor = (productIds: string[]): Promise<Record<string, number | null>> => {
    const addressee =
      priceContext.submissionType === "DELIVERY_LOCATION" ? "DELIVERY_LOCATION" : "CUSTOMER";
    const addresseeId =
      addressee === "DELIVERY_LOCATION" ? priceContext.deliveryLocationId : priceContext.customerId;
    return resolveSellingPricesForDisplay({
      estimateDate: priceContext.estimateDate,
      addressee,
      addresseeId,
      productIds,
    });
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

  // 商品選択: セット商品なら構成を自動展開して群ノードを挿入、通常商品ならスナップショット解決して
  // 通常行を挿入する。いずれも見積単価を価格決定でライブ解決し、解決不能なら行を追加せずエラー表示
  // する（ADR-0064: 0円明細を作らない・セットは不能な構成があれば展開ごと拒否）。挿入位置はアクティブ
  // ノード直下（構成/群がアクティブなら群の直後＝トップレベル）。
  const handleProductSelect = async (rows: ProductSelectionRow[]) => {
    const picked = rows[0];
    if (!picked) return;

    if (picked.category === "SET") {
      const expanded = await expandSetComponents(picked.id);
      if (!expanded) return;
      const componentIds = expanded.components.map((c) => c.productId);
      const prices = await resolvePricesFor(componentIds);
      // 1構成でも解決不能なら展開ごと拒否し、不能な構成商品名を列挙する（重複は除く）。
      // `== null` で undefined（見積年月日未入力時の空マップ）も解決不能として拾う（通常明細157・サジェスト182と対称）。
      const unresolved = expanded.components.filter((c) => prices[c.productId] == null);
      if (unresolved.length > 0) {
        const names = [...new Set(unresolved.map((c) => c.name))];
        setSelectionError(
          `セット「${expanded.name}」は次の構成商品に有効な販売単価が無いため展開できません: ${names.join("、")}`
        );
        return;
      }
      const groupRowId = crypto.randomUUID();
      const group = createWorkingSetGroup(
        groupRowId,
        expanded,
        () => crypto.randomUUID(),
        (productId) => prices[productId]!
      );
      setSelectionError(null);
      setNodes((prev) => insertNodesBelow(prev, activeRowId, [group]));
      setActiveRowId(groupRowId);
      // セット商品は周辺商品サジェストの対象外（構成は自動展開で確定）。
      return;
    }

    const snapshot = await getProductLineSnapshot(picked.id);
    if (!snapshot) return;
    const prices = await resolvePricesFor([snapshot.id]);
    if (prices[snapshot.id] == null) {
      setSelectionError(
        `「${snapshot.name}」には有効な販売単価が設定されていないため明細に追加できません。`
      );
      return;
    }
    const newLine = createWorkingLine(crypto.randomUUID(), snapshot, {
      unitPrice: prices[snapshot.id]!,
    });
    setSelectionError(null);
    setNodes((prev) => insertNodesBelow(prev, activeRowId, [newLine]));
    setActiveRowId(newLine.rowId);

    const suggestions = await getProductSuggestions(snapshot.id);
    if (suggestions.length > 0) {
      setSuggestState({ mainRowId: newLine.rowId, mainName: snapshot.name, suggestions });
    }
  };

  // 提案された周辺商品（選択分）を本体直下に通常行として挿入する（数量＝relation・他は新規行既定）。
  // 各商品の見積単価を解決し、解決可能な商品のみ追加する。解決不能な商品はスキップして列挙する
  // （本体は既に追加済みのため、周辺のみ部分的に取りこぼしても操作全体は破棄しない）。
  const confirmSuggestions = async (selected: SuggestedProduct[]) => {
    if (!suggestState) return;
    const prices = await resolvePricesFor(selected.map((s) => s.id));
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
    confirmSuggestions,
  };
}

export type VariationLineEditor = ReturnType<typeof useVariationLineEditor>;
