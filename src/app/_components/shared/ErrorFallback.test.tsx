import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorFallback } from "./ErrorFallback";

describe("ErrorFallback", () => {
  it("固定の汎用メッセージを表示する", () => {
    render(<ErrorFallback reset={vi.fn()} />);

    expect(screen.getByText("問題が発生しました")).toBeInTheDocument();
    expect(screen.getByText(/予期しないエラーが発生しました/)).toBeInTheDocument();
  });

  it("digest があれば参照 ID として表示する", () => {
    render(<ErrorFallback reset={vi.fn()} digest="abc123" />);

    expect(screen.getByText("参照 ID: abc123")).toBeInTheDocument();
  });

  it("digest が無ければ参照 ID を表示しない", () => {
    render(<ErrorFallback reset={vi.fn()} />);

    expect(screen.queryByText(/参照 ID:/)).not.toBeInTheDocument();
  });

  it("再試行ボタン押下で reset を呼ぶ", async () => {
    const reset = vi.fn();
    render(<ErrorFallback reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("トップへ戻る導線を持つ", () => {
    render(<ErrorFallback reset={vi.fn()} />);

    const link = screen.getByRole("link", { name: "トップへ戻る" });
    expect(link).toHaveAttribute("href", "/dashboard");
  });
});
