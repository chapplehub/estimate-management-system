import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { createEmployee } from "./actions";
import { EmployeeCreateForm } from "./EmployeeCreateForm";

const mockEmployee = {
  name: "Test Taro",
  email: "test@example.com",
  employeeCd: "EMP999999",
  role: "USER",
};

// Server Action をモックする
vi.mock("./actions", () => ({
  createEmployee: vi.fn().mockResolvedValue({
    message: "",
    errors: [],
  }),
}));

describe("EmployeeCreateForm", () => {
  test("正常な値でフォームをサブミットした場合、createEmployeeが呼び出される", async () => {
    render(<EmployeeCreateForm />);

    const nameTextBox = screen.getByRole("textbox", { name: "name" });
    // TODO: 入力処理を書いていく。

    const submitButton = screen.getByRole("button", { name: "登録" });
    await userEvent.click(submitButton);

    expect(createEmployee).toHaveBeenCalled();
  });
});
