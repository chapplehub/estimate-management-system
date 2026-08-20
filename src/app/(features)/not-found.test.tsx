import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FeaturesNotFound from "./not-found";

describe("(features)/not-found", () => {
  it("見つからなかった旨の固定メッセージを表示する", () => {
    render(<FeaturesNotFound />);

    expect(screen.getByText("ページが見つかりませんでした")).toBeInTheDocument();
    expect(screen.getByText(/存在しないか、移動または削除された/)).toBeInTheDocument();
  });

  it("トップへ戻る導線を持つ", () => {
    render(<FeaturesNotFound />);

    const link = screen.getByRole("link", { name: "トップへ戻る" });
    expect(link).toHaveAttribute("href", "/dashboard");
  });
});
