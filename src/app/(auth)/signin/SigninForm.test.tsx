import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach, type Mock } from "vitest";
import { signinAction } from "./actions";
import { SigninForm } from "./_components/signin-form";

// Server Action をモック
vi.mock("./actions", () => ({
  signinAction: vi.fn(),
}));

const mockSigninAction = signinAction as Mock;

describe("SigninForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのモック: 成功時はredirectするため undefined を返す
    mockSigninAction.mockResolvedValue(undefined);
  });

  describe("レンダリングテスト", () => {
    test("全てのフォームフィールドが表示される", () => {
      render(<SigninForm />);

      // 各フィールドのラベルが表示されていることを確認
      expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
      expect(screen.getByLabelText("パスワード")).toBeInTheDocument();

      // 送信ボタンが表示されていることを確認
      expect(screen.getByRole("button", { name: "サインイン" })).toBeInTheDocument();
    });

    test("カードヘッダーにタイトルと説明が表示される", () => {
      render(<SigninForm />);

      // h1要素として描画されるのでgetByRoleが使える
      expect(screen.getByRole("heading", { name: "サインイン", level: 1 })).toBeInTheDocument();
      expect(screen.getByText("メールアドレスとパスワードを入力してください")).toBeInTheDocument();
    });

    test("プレースホルダーが表示される", () => {
      render(<SigninForm />);

      expect(screen.getByPlaceholderText("example@company.com")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("パスワードを入力")).toBeInTheDocument();
    });
  });

  describe("入力テスト", () => {
    test("ユーザーがメールアドレスを入力できる", async () => {
      const user = userEvent.setup();
      render(<SigninForm />);

      const emailInput = screen.getByLabelText("メールアドレス");
      await user.type(emailInput, "test@example.com");
      expect(emailInput).toHaveValue("test@example.com");
    });

    test("ユーザーがパスワードを入力できる", async () => {
      const user = userEvent.setup();
      render(<SigninForm />);

      const passwordInput = screen.getByLabelText("パスワード");
      await user.type(passwordInput, "password123!");
      expect(passwordInput).toHaveValue("password123!");
    });
  });

  describe("サブミットテスト", () => {
    test("フォームを送信するとsigninActionが呼び出される", async () => {
      const user = userEvent.setup();
      render(<SigninForm />);

      // 必須フィールドに値を入力
      await user.type(screen.getByLabelText("メールアドレス"), "test@example.com");
      await user.type(screen.getByLabelText("パスワード"), "password123!");

      // フォームを送信
      const submitButton = screen.getByRole("button", { name: "サインイン" });
      await user.click(submitButton);

      // signinActionが呼び出されたことを確認
      expect(mockSigninAction).toHaveBeenCalled();
    });

    test("送信されたFormDataに正しい値が含まれている", async () => {
      const user = userEvent.setup();
      render(<SigninForm />);

      // 必須フィールドに値を入力
      await user.type(screen.getByLabelText("メールアドレス"), "test@example.com");
      await user.type(screen.getByLabelText("パスワード"), "password123!");

      // フォームを送信
      await user.click(screen.getByRole("button", { name: "サインイン" }));

      // signinActionの引数を検証
      expect(mockSigninAction).toHaveBeenCalled();
      const callArgs = mockSigninAction.mock.calls[0];
      const formData = callArgs[1] as FormData;

      expect(formData.get("email")).toBe("test@example.com");
      expect(formData.get("password")).toBe("password123!");
    });
  });

  describe("エラー表示テスト", () => {
    test("認証失敗時に全体エラーメッセージが表示される", async () => {
      const user = userEvent.setup();

      // Conform形式のエラーレスポンスを返すようにモック
      // formErrors は空文字キー "" に格納される
      mockSigninAction.mockResolvedValue({
        status: "error",
        error: {
          "": ["メールアドレスまたはパスワードが正しくありません"],
        },
        initialValue: {},
      });

      render(<SigninForm />);

      // 必須フィールドに値を入力
      await user.type(screen.getByLabelText("メールアドレス"), "test@example.com");
      await user.type(screen.getByLabelText("パスワード"), "password123!");

      // フォームを送信
      await user.click(screen.getByRole("button", { name: "サインイン" }));

      // エラーメッセージが表示されることを確認
      expect(
        await screen.findByText("メールアドレスまたはパスワードが正しくありません")
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    test("メールアドレスのバリデーションエラーが表示される（サーバーサイド）", async () => {
      const user = userEvent.setup();

      // Conform形式のフィールドエラーを返すようにモック
      // 例：メールアドレスが既に登録されている場合など
      mockSigninAction.mockResolvedValue({
        status: "error",
        error: {
          email: ["このメールアドレスは登録されていません。"],
        },
        initialValue: {
          email: "notfound@example.com",
          password: "password123!",
        },
      });

      render(<SigninForm />);

      // 有効な形式の値を入力（クライアントバリデーションを通過させる）
      await user.type(screen.getByLabelText("メールアドレス"), "notfound@example.com");
      await user.type(screen.getByLabelText("パスワード"), "password123!");

      // フォームを送信
      await user.click(screen.getByRole("button", { name: "サインイン" }));

      // signinActionが呼び出されたことを確認
      await waitFor(() => {
        expect(mockSigninAction).toHaveBeenCalled();
      });

      // エラーメッセージが表示されることを確認
      expect(
        await screen.findByText("このメールアドレスは登録されていません。")
      ).toBeInTheDocument();
    });

    test("パスワードのバリデーションエラーが複数表示される（クライアントサイド）", async () => {
      const user = userEvent.setup();
      render(<SigninForm />);

      // 有効なメールアドレスを入力
      await user.type(screen.getByLabelText("メールアドレス"), "test@example.com");

      // 無効なパスワードを入力してblurをトリガー（クライアントバリデーション）
      const passwordInput = screen.getByLabelText("パスワード");
      await user.type(passwordInput, "pass");
      await user.tab(); // blurイベントをトリガー

      // クライアントサイドバリデーションエラーが表示されることを確認
      expect(await screen.findByText("8文字以上である必要があります")).toBeInTheDocument();
      expect(screen.getByText("パスワードは以下を含む必要があります：")).toBeInTheDocument();
    });
  });
});
