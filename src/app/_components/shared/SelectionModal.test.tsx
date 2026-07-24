import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectionModal, type SelectionConfirmHandler } from "./SelectionModal";
import type { ColumnDef } from "./DataTable";
import type { SearchFieldDef } from "./SearchForm";

/**
 * 確定拒否の経路（ADR-20260716-r4d）。
 *
 * `onConfirm` が `{ kind: "confirmed" }` を返せば閉じ、`{ kind: "rejected" }` を返せば閉じずに
 * 文言と原因行のハイライトを出す。検証の継ぎ目は `data-invalid` 属性（配色クラスは assert しない）。
 *
 * 加えて確定中断の経路（`{ kind: "aborted" }` / ADR-20260723-h7r）。非業務例外で確定に必要な
 * データを取れなかった場合は、閉じず・理由も出さず・state を凍結する。
 */

type Row = { id: string; name: string };

const ROWS: Row[] = [
  { id: "p1", name: "商品A" },
  { id: "p2", name: "商品B" },
];

const SEARCH_FIELDS: SearchFieldDef[] = [{ type: "text", key: "name", label: "商品名" }];

const COLUMNS: ColumnDef<Row, unknown>[] = [{ accessorKey: "name", header: "商品名" }];

function renderModal(overrides: {
  onConfirm: SelectionConfirmHandler<Row>;
  onClose?: () => void;
  searchAction?: (criteria: Record<string, string>) => Promise<Row[]>;
}) {
  return render(
    <SelectionModal
      isOpen
      onClose={overrides.onClose ?? vi.fn()}
      title="商品選択"
      searchFields={SEARCH_FIELDS}
      searchAction={overrides.searchAction ?? vi.fn().mockResolvedValue(ROWS)}
      searchActionName="searchProductsForSelection"
      columns={COLUMNS}
      onConfirm={overrides.onConfirm}
      getRowId={(row) => row.id}
      emptyMessage="商品がありません"
    />
  );
}

/** 検索を実行して結果行を出し、指定した行名のチェックを入れる。 */
async function searchAndSelect(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  await user.click(screen.getByRole("button", { name: "検索" }));
  await screen.findByText("商品A");
  for (const name of names) {
    const row = screen.getByText(name).closest("tr")!;
    await user.click(within(row).getByRole("checkbox"));
  }
}

/** 行の <tr> を行名から引く。 */
function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest("tr")!;
}

describe("SelectionModal の確定拒否", () => {
  it("onConfirm が rejected を返したら閉じず、文言と原因行のハイライトを出す", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue({
      kind: "rejected",
      message: "商品Aには販売単価がありません",
      invalidIds: ["p1"],
    });

    renderModal({ onConfirm, onClose });
    await searchAndSelect(user, "商品A", "商品B");
    await user.click(screen.getByRole("button", { name: "2件を追加" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("商品Aには販売単価がありません");
    expect(rowOf("商品A")).toHaveAttribute("data-invalid", "true");
    expect(rowOf("商品B")).not.toHaveAttribute("data-invalid");
  });

  it("原因行には既定の hover 配色が出力されない（hover でハイライトが消えないこと）", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue({
      kind: "rejected",
      message: "商品Aには販売単価がありません",
      invalidIds: ["p1"],
    });

    renderModal({ onConfirm });
    await searchAndSelect(user, "商品A", "商品B");
    await user.click(screen.getByRole("button", { name: "2件を追加" }));
    await screen.findByRole("alert");

    // 既定の hover 配色を残したままハイライト色を追記すると、hover の詳細度（0-2-0）が
    // ハイライト（0-1-0）に勝ち、原因行にマウスを乗せた瞬間＝チェックを外そうとした瞬間に
    // ハイライトが消える。ハイライトの色味は assert しない（見た目の変更で割れるため）。
    expect(rowOf("商品A")).not.toHaveClass("hover:bg-gray-50");
    expect(rowOf("商品B")).toHaveClass("hover:bg-gray-50");
  });

  it("拒否後も選択状態は保たれ、原因商品のチェックを外すだけで再確定できる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "rejected",
        message: "商品Aには販売単価がありません",
        invalidIds: ["p1"],
      })
      .mockResolvedValueOnce({ kind: "confirmed" });

    renderModal({ onConfirm, onClose });
    await searchAndSelect(user, "商品A", "商品B");
    await user.click(screen.getByRole("button", { name: "2件を追加" }));
    await screen.findByRole("alert");

    // 拒否されても選択は消えない（2件のまま）。
    expect(screen.getByRole("button", { name: "2件を追加" })).toBeInTheDocument();

    // 原因商品のチェックを外して再確定すると、残りの1件で通る。
    await user.click(within(rowOf("商品A")).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "1件を追加" }));

    expect(onConfirm).toHaveBeenLastCalledWith([{ id: "p2", name: "商品B" }]);
    expect(onClose).toHaveBeenCalled();
  });

  it("新しい検索を実行すると拒否状態（文言・ハイライト）がクリアされる", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue({
      kind: "rejected",
      message: "商品Aには販売単価がありません",
      invalidIds: ["p1"],
    });

    renderModal({ onConfirm });
    await searchAndSelect(user, "商品A");
    await user.click(screen.getByRole("button", { name: "1件を追加" }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "検索" }));
    await screen.findByText("商品A");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(rowOf("商品A")).not.toHaveAttribute("data-invalid");
  });

  it("onConfirm が confirmed を返したら閉じる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    // 確定成立は明示的に返させる。旧契約は「何も返さない＝成立」だったが、書き忘れと区別できず
    // 無言で閉じるバグを生んだため廃止した（#634・#635）。
    const onConfirm = vi.fn().mockResolvedValue({ kind: "confirmed" });

    renderModal({ onConfirm, onClose });
    await searchAndSelect(user, "商品A");
    await user.click(screen.getByRole("button", { name: "1件を追加" }));

    expect(onConfirm).toHaveBeenCalledWith([{ id: "p1", name: "商品A" }]);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("SelectionModal の確定中断", () => {
  it("onConfirm が aborted を返したら閉じず、理由も出さず、検索結果と選択状態を保つ", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue({ kind: "aborted" });

    renderModal({ onConfirm, onClose });
    await searchAndSelect(user, "商品A", "商品B");
    await user.click(screen.getByRole("button", { name: "2件を追加" }));

    expect(onClose).not.toHaveBeenCalled();
    // 通知は callReadAction の toast が担うため、モーダル内には理由を出さない（二重表示の防止）。
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // 検索結果・選択状態が凍結されている（件数表示が 2件のまま = rowSelection も data も無傷）。
    expect(screen.getByRole("button", { name: "2件を追加" })).toBeEnabled();
    expect(rowOf("商品A")).not.toHaveAttribute("data-invalid");
  });

  it("中断後は同じ選択のまま再確定でリトライできる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi
      .fn()
      .mockResolvedValueOnce({ kind: "aborted" })
      .mockResolvedValueOnce({ kind: "confirmed" });

    renderModal({ onConfirm, onClose });
    await searchAndSelect(user, "商品A", "商品B");
    await user.click(screen.getByRole("button", { name: "2件を追加" }));
    expect(onClose).not.toHaveBeenCalled();

    // 選択し直さずにもう一度確定するだけで、同じ2件がそのまま親へ渡る。
    await user.click(screen.getByRole("button", { name: "2件を追加" }));

    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenLastCalledWith([
      { id: "p1", name: "商品A" },
      { id: "p2", name: "商品B" },
    ]);
    expect(onClose).toHaveBeenCalled();
  });
});
