import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchForm, type SearchFieldDef } from "./SearchForm";

// useRouter().push / usePathname をモック（検索は URL を組み立てて router.push する）。
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/estimate-applications",
}));

beforeEach(() => {
  pushMock.mockClear();
});

/** router.push に渡った URL の query 部を URLSearchParams として取り出す。 */
function pushedParams(): URLSearchParams {
  const url = pushMock.mock.calls.at(-1)?.[0] as string;
  const queryString = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  return new URLSearchParams(queryString);
}

describe("SearchForm multiselect フィールド", () => {
  const fields: SearchFieldDef[] = [
    {
      type: "multiselect",
      key: "state",
      label: "申請状態",
      options: [
        { value: "PENDING", label: "申請中" },
        { value: "APPROVED", label: "承認済" },
        { value: "EXEMPTED", label: "承認不要" },
      ],
    },
  ];

  it("option ごとにチェックボックスをラベル付きで描画する", () => {
    render(<SearchForm fields={fields} defaultValues={{ state: [] }} />);

    expect(screen.getByRole("checkbox", { name: "申請中" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "承認済" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "承認不要" })).toBeInTheDocument();
  });

  it("複数チェックして検索すると繰り返しパラメータ（?state=A&state=B）へ直列化する", async () => {
    const user = userEvent.setup();
    render(<SearchForm fields={fields} defaultValues={{ state: [] }} />);

    await user.click(screen.getByRole("checkbox", { name: "申請中" }));
    await user.click(screen.getByRole("checkbox", { name: "承認不要" }));
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(pushedParams().getAll("state")).toEqual(["PENDING", "EXEMPTED"]);
  });

  it("defaultValues の選択済みを反映し、外すと検索パラメータから消える", async () => {
    const user = userEvent.setup();
    render(<SearchForm fields={fields} defaultValues={{ state: ["PENDING", "APPROVED"] }} />);

    expect(screen.getByRole("checkbox", { name: "申請中" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "承認済" })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "申請中" })); // 外す
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(pushedParams().getAll("state")).toEqual(["APPROVED"]);
  });
});

describe("SearchForm date フィールド", () => {
  const fields: SearchFieldDef[] = [{ type: "date", key: "appliedFrom", label: "申請日From" }];

  it("入力した暦日文字列を単一パラメータへ直列化する", async () => {
    const user = userEvent.setup();
    render(<SearchForm fields={fields} defaultValues={{ appliedFrom: "" }} />);

    const input = screen.getByLabelText("申請日From");
    await user.type(input, "2026-07-01");
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(pushedParams().get("appliedFrom")).toBe("2026-07-01");
  });
});

describe("SearchForm checkbox フィールド", () => {
  const fields: SearchFieldDef[] = [
    { type: "checkbox", key: "includeInactive", label: "無効も含む" },
  ];

  it("チェックすると真値 'true' を、外すとパラメータ自体を出さない", async () => {
    const user = userEvent.setup();
    render(<SearchForm fields={fields} defaultValues={{ includeInactive: "" }} />);

    await user.click(screen.getByRole("checkbox", { name: "無効も含む" }));
    await user.click(screen.getByRole("button", { name: "検索" }));
    expect(pushedParams().get("includeInactive")).toBe("true");

    await user.click(screen.getByRole("checkbox", { name: "無効も含む" })); // 外す
    await user.click(screen.getByRole("button", { name: "検索" }));
    expect(pushedParams().has("includeInactive")).toBe(false);
  });
});

describe("SearchForm 既存 text/select フィールド（非破壊）", () => {
  const fields: SearchFieldDef[] = [
    { type: "text", key: "estimateNumber", label: "見積番号" },
    {
      type: "select",
      key: "estimateType",
      label: "区分",
      options: [
        { value: "NEW", label: "新規" },
        { value: "REPAIR", label: "修理" },
      ],
    },
  ];

  it("text は trim して、select は選択値をパラメータへ直列化する", async () => {
    const user = userEvent.setup();
    render(<SearchForm fields={fields} defaultValues={{ estimateNumber: "", estimateType: "" }} />);

    await user.type(screen.getByLabelText("見積番号"), "  N99  ");
    await user.selectOptions(screen.getByLabelText("区分"), "REPAIR");
    await user.click(screen.getByRole("button", { name: "検索" }));

    const params = pushedParams();
    expect(params.get("estimateNumber")).toBe("N99");
    expect(params.get("estimateType")).toBe("REPAIR");
  });
});
