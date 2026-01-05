import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach, type Mock } from "vitest";
import { createEmployee } from "./actions";
import { EmployeeCreateForm } from "./EmployeeCreateForm";

// Server Action をモック
vi.mock("./actions", () => ({
  createEmployee: vi.fn(),
}));

const mockCreateEmployee = createEmployee as Mock;

describe("EmployeeCreateForm", () => {
  beforeEach(() => {
    // デフォルトのモック: 成功時はredirectするため undefined を返す
    mockCreateEmployee.mockResolvedValue(undefined);
  });

  describe("レンダリングテスト", () => {
    test("全てのフォームフィールドが表示される", () => {
      render(<EmployeeCreateForm />);

      // 各フィールドのラベルが表示されていることを確認
      expect(screen.getByLabelText("名前")).toBeInTheDocument();
      expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
      expect(screen.getByLabelText("従業員コード")).toBeInTheDocument();
      expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
      expect(screen.getByLabelText("権限")).toBeInTheDocument();

      // 送信ボタンが表示されていることを確認
      expect(screen.getByRole("button", { name: "登録" })).toBeInTheDocument();
    });

    test("権限のセレクトボックスにオプションが表示される", () => {
      render(<EmployeeCreateForm />);

      const roleSelect = screen.getByLabelText("権限");
      expect(roleSelect).toHaveValue("user"); // デフォルト値

      // オプションの存在を確認
      expect(screen.getByRole("option", { name: "一般ユーザー" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "管理者" })).toBeInTheDocument();
    });

    test("従業員コードの入力ヒントが表示される", () => {
      render(<EmployeeCreateForm />);

      expect(screen.getByText("形式: EMP + 6桁の数字（例: EMP000001）")).toBeInTheDocument();
    });
  });

  describe("入力テスト", () => {
    test("ユーザーがフォームに値を入力できる", async () => {
      const user = userEvent.setup();
      render(<EmployeeCreateForm />);

      // 各フィールドに値を入力
      const nameInput = screen.getByLabelText("名前");
      await user.type(nameInput, "山田太郎");
      expect(nameInput).toHaveValue("山田太郎");

      const emailInput = screen.getByLabelText("メールアドレス");
      await user.type(emailInput, "yamada@example.com");
      expect(emailInput).toHaveValue("yamada@example.com");

      const employeeCdInput = screen.getByLabelText("従業員コード");
      await user.type(employeeCdInput, "EMP000001");
      expect(employeeCdInput).toHaveValue("EMP000001");

      const passwordInput = screen.getByLabelText("パスワード");
      await user.type(passwordInput, "password123");
      expect(passwordInput).toHaveValue("password123");
    });

    test("権限を変更できる", async () => {
      const user = userEvent.setup();
      render(<EmployeeCreateForm />);

      const roleSelect = screen.getByLabelText("権限");

      await user.selectOptions(roleSelect, "admin");
      expect(roleSelect).toHaveValue("admin");

      await user.selectOptions(roleSelect, "user");
      expect(roleSelect).toHaveValue("user");
    });
  });

  describe("サブミットテスト", () => {
    test("フォームを送信するとcreateEmployeeが呼び出される", async () => {
      const user = userEvent.setup();
      render(<EmployeeCreateForm />);

      // 必須フィールドに値を入力
      await user.type(screen.getByLabelText("名前"), "山田太郎");
      await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
      await user.type(screen.getByLabelText("従業員コード"), "EMP000001");
      await user.type(screen.getByLabelText("パスワード"), "password123");

      // フォームを送信
      const submitButton = screen.getByRole("button", { name: "登録" });
      await user.click(submitButton);

      // createEmployeeが呼び出されたことを確認
      expect(mockCreateEmployee).toHaveBeenCalled();
    });

    test("送信されたFormDataに正しい値が含まれている", async () => {
      const user = userEvent.setup();
      render(<EmployeeCreateForm />);

      // 必須フィールドに値を入力
      await user.type(screen.getByLabelText("名前"), "山田太郎");
      await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
      await user.type(screen.getByLabelText("従業員コード"), "EMP000001");
      await user.type(screen.getByLabelText("パスワード"), "password123");
      await user.selectOptions(screen.getByLabelText("権限"), "admin");

      // フォームを送信
      await user.click(screen.getByRole("button", { name: "登録" }));

      // createEmployeeの引数を検証
      expect(mockCreateEmployee).toHaveBeenCalled();
      const callArgs = mockCreateEmployee.mock.calls[0];
      const formData = callArgs[1] as FormData;

      expect(formData.get("name")).toBe("山田太郎");
      expect(formData.get("email")).toBe("yamada@example.com");
      expect(formData.get("employeeCd")).toBe("EMP000001");
      expect(formData.get("password")).toBe("password123");
      expect(formData.get("role")).toBe("admin");
    });
  });

  describe("エラー表示テスト", () => {
    test("全体エラーメッセージが表示される", async () => {
      const user = userEvent.setup();

      // Conform形式のエラーレスポンスを返すようにモック
      // formErrors は空文字キー "" に格納される
      mockCreateEmployee.mockResolvedValue({
        status: "error",
        error: {
          "": ["サーバーエラーが発生しました"],
        },
        initialValue: {},
      });

      render(<EmployeeCreateForm />);

      // 必須フィールドに値を入力
      await user.type(screen.getByLabelText("名前"), "山田太郎");
      await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
      await user.type(screen.getByLabelText("従業員コード"), "EMP000001");
      await user.type(screen.getByLabelText("パスワード"), "password123");

      // フォームを送信
      await user.click(screen.getByRole("button", { name: "登録" }));

      // エラーメッセージが表示されることを確認
      expect(await screen.findByText("サーバーエラーが発生しました")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // サーバーサイドのバリデーションエラーをテスト
    // HTML5バリデーションを通過する有効な値を入力し、サーバーがエラーを返すシナリオ
    test("フィールドごとのバリデーションエラーが表示される", async () => {
      const user = userEvent.setup();

      // Conform形式のフィールドエラーを返すようにモック
      mockCreateEmployee.mockResolvedValue({
        status: "error",
        error: {
          name: ["名前は2文字以上で入力してください"],
          email: ["このメールアドレスは既に使用されています"],
          employeeCd: ["この従業員コードは既に使用されています"],
        },
        initialValue: {
          name: "山田太郎",
          email: "yamada@example.com",
          employeeCd: "EMP000001",
        },
      });

      render(<EmployeeCreateForm />);

      // HTML5バリデーションを通過する有効な値を入力
      // （サーバーサイドでエラーを返すシナリオ）
      await user.type(screen.getByLabelText("名前"), "山田太郎");
      await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
      await user.type(screen.getByLabelText("従業員コード"), "EMP000001");
      await user.type(screen.getByLabelText("パスワード"), "password123");

      // フォームを送信
      await user.click(screen.getByRole("button", { name: "登録" }));

      // createEmployeeが呼び出されたことを確認
      await waitFor(() => {
        expect(mockCreateEmployee).toHaveBeenCalled();
      });

      // 各フィールドのエラーメッセージが表示されることを確認
      expect(await screen.findByText("名前は2文字以上で入力してください")).toBeInTheDocument();
      expect(screen.getByText("このメールアドレスは既に使用されています")).toBeInTheDocument();
      expect(screen.getByText("この従業員コードは既に使用されています")).toBeInTheDocument();
    });
  });
});
