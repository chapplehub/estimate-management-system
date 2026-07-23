import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectionModal, type SelectionRejection } from "./SelectionModal";
import type { ColumnDef } from "./DataTable";
import type { SearchFieldDef } from "./SearchForm";

/**
 * 確定拒否の経路（ADR-20260716-r4d）。
 *
 * `onConfirm` が `undefined` を返せば従来どおり閉じ、`SelectionRejection` を返せば閉じずに
 * 文言と原因行のハイライトを出す。検証の継ぎ目は `data-invalid` 属性（配色クラスは assert しない）。
 */

type Row = { id: string; name: string };

const ROWS: Row[] = [
  { id: "p1", name: "商品A" },
  { id: "p2", name: "商品B" },
];

const SEARCH_FIELDS: SearchFieldDef[] = [{ type: "text", key: "name", label: "商品名" }];

const COLUMNS: ColumnDef<Row, unknown>[] = [{ accessorKey: "name", header: "商品名" }];

function renderModal(overrides: {
  onConfirm: (items: Row[]) => void | Promise<void | SelectionRejection>;
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
  it("onConfirm が SelectionRejection を返したら閉じず、文言と原因行のハイライトを出す", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ message: "商品Aには販売単価がありません", invalidIds: ["p1"] });

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
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ message: "商品Aには販売単価がありません", invalidIds: ["p1"] });

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
      .mockResolvedValueOnce({ message: "商品Aには販売単価がありません", invalidIds: ["p1"] })
      .mockResolvedValueOnce(undefined);

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
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ message: "商品Aには販売単価がありません", invalidIds: ["p1"] });

    renderModal({ onConfirm });
    await searchAndSelect(user, "商品A");
    await user.click(screen.getByRole("button", { name: "1件を追加" }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "検索" }));
    await screen.findByText("商品A");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(rowOf("商品A")).not.toHaveAttribute("data-invalid");
  });

  it("onConfirm が何も返さなければ従来どおり閉じる（既存呼び出し元の無改修を守る）", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    renderModal({ onConfirm, onClose });
    await searchAndSelect(user, "商品A");
    await user.click(screen.getByRole("button", { name: "1件を追加" }));

    expect(onConfirm).toHaveBeenCalledWith([{ id: "p1", name: "商品A" }]);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
