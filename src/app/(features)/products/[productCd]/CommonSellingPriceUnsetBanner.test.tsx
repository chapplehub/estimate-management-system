import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommonSellingPriceUnsetBanner } from "./CommonSellingPriceUnsetBanner";

describe("CommonSellingPriceUnsetBanner", () => {
  it("priceStatus=unset のとき未設定を促す文面と設定リンクを表示する", () => {
    render(<CommonSellingPriceUnsetBanner priceStatus="unset" productCode="P001" />);

    expect(screen.getByText(/未設定/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /設定/ });
    expect(link).toHaveAttribute("href", "/common-selling-prices/P001");
  });

  it("priceStatus=lapsed のとき失効中の文面と設定リンクを表示する", () => {
    render(<CommonSellingPriceUnsetBanner priceStatus="lapsed" productCode="P002" />);

    expect(screen.getByText(/失効中/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /設定/ });
    expect(link).toHaveAttribute("href", "/common-selling-prices/P002");
  });

  it("priceStatus=active のときは何も描画しない（誘導しない）", () => {
    const { container } = render(
      <CommonSellingPriceUnsetBanner priceStatus="active" productCode="P003" />
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
