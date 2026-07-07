import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { updateEmployee } from "./actions";
import { EmployeeUpdateForm } from "./EmployeeUpdateForm";
import { USER_ROLES } from "@server/shared/auth/types";

// Server Action をモック
vi.mock("./actions", () => ({
  updateEmployee: vi.fn(),
}));

// toast をモック
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

const mockUpdateEmployee = updateEmployee as Mock;

// テスト用の従業員データ
const mockEmployee = {
  id: "test-id-123",
  name: "山田太郎",
  email: "yamada@example.com",
  employeeCd: "EMP000001",
  departmentId: "dept-1",
  role: USER_ROLES.USER,
  assignedRoleId: null,
  version: 3,
};

// 部署選択スロットのモック
const mockDepartmentSelectSlot = (
  <select name="departmentId" id="departmentId" aria-label="所属部署" defaultValue="dept-1">
    <option value="">選択してください</option>
    <option value="dept-1">営業部</option>
    <option value="dept-2">開発部</option>
  </select>
);

// 担当役割オプションのモック（page.tsx が findAll で取得し {id,name}[] を供給）
const mockRoleOptions = [
  { id: "role-1", name: "営業課長" },
  { id: "role-2", name: "開発部長" },
];

describe("EmployeeUpdateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのモック: 成功時
    mockUpdateEmployee.mockResolvedValue({
      status: "success",
    });
  });

  describe("レンダリングテスト", () => {
    test("全てのフォームフィールドが表示される", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      // 各フィールドのラベルが表示されていることを確認
      expect(screen.getByLabelText("名前")).toBeInTheDocument();
      expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
      expect(screen.getByLabelText("従業員コード")).toBeInTheDocument();
      expect(screen.getByLabelText("権限")).toBeInTheDocument();
      expect(screen.getByLabelText("所属部署")).toBeInTheDocument();

      // 送信ボタンが表示されていることを確認
      expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
    });

    test("初期値が正しく設定される", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByLabelText("名前")).toHaveValue("山田太郎");
      expect(screen.getByLabelText("メールアドレス")).toHaveValue("yamada@example.com");
      expect(screen.getByLabelText("従業員コード")).toHaveValue("EMP000001");
      expect(screen.getByLabelText("権限")).toHaveValue(USER_ROLES.USER);
    });

    test("従業員コードは読み取り専用で表示される", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      const employeeCdInput = screen.getByLabelText("従業員コード");
      expect(employeeCdInput).toBeDisabled();
      expect(employeeCdInput).toHaveAttribute("readonly");
    });

    test("従業員コードの入力ヒントが表示される", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByText("形式: EMP + 6桁の数字（例: EMP000001）")).toBeInTheDocument();
    });

    test("権限のセレクトボックスにオプションが表示される", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByRole("option", { name: "一般ユーザー" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "管理者" })).toBeInTheDocument();
    });
  });

  describe("担当役割セレクト", () => {
    test("担当役割セレクトが表示され、（担当役割なし）を含む役割オプションが並ぶ", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByLabelText("担当役割")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "（担当役割なし）" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "営業課長" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "開発部長" })).toBeInTheDocument();
    });

    test("assignedRoleId が現在の担当役割として preselect される", () => {
      render(
        <EmployeeUpdateForm
          employee={{ ...mockEmployee, assignedRoleId: "role-2" }}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByLabelText("担当役割")).toHaveValue("role-2");
    });

    test("担当役割が未設定なら空選択（担当役割なし）が初期値", () => {
      render(
        <EmployeeUpdateForm
          employee={{ ...mockEmployee, assignedRoleId: null }}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByLabelText("担当役割")).toHaveValue("");
    });

    test("canUpdate=false のとき担当役割セレクトは無効になる", () => {
      render(
        <EmployeeUpdateForm
          employee={{ ...mockEmployee, assignedRoleId: "role-2" }}
          canUpdate={false}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByLabelText("担当役割")).toBeDisabled();
    });
  });

  describe("承認者不在ワーニング（非ブロッキング）", () => {
    // 唯一メンバー（isSoleMemberOfCurrentRole=true）が現在の担当役割「開発部長」(role-2) から
    // 抜けるケース。旧役割名を明示した警告を反応的に表示する。
    const soleMemberEmployee = { ...mockEmployee, assignedRoleId: "role-2" };

    test("初期状態（現在の役割のまま）では警告は表示されない", () => {
      render(
        <EmployeeUpdateForm
          employee={soleMemberEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={true}
        />
      );

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    test("唯一メンバーが別の担当役割へ変更すると旧役割名入りの警告が表示される", async () => {
      const user = userEvent.setup();
      render(
        <EmployeeUpdateForm
          employee={soleMemberEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={true}
        />
      );

      await user.selectOptions(screen.getByLabelText("担当役割"), "role-1");

      const warning = await screen.findByRole("status");
      expect(warning).toBeInTheDocument();
      // 旧役割名を明示
      expect(warning).toHaveTextContent("開発部長");
    });

    test("唯一メンバーが担当役割を解除しても警告が表示される", async () => {
      const user = userEvent.setup();
      render(
        <EmployeeUpdateForm
          employee={soleMemberEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={true}
        />
      );

      await user.selectOptions(screen.getByLabelText("担当役割"), "");

      expect(await screen.findByRole("status")).toBeInTheDocument();
    });

    test("変更後に元の担当役割へ戻すと警告は消える", async () => {
      const user = userEvent.setup();
      render(
        <EmployeeUpdateForm
          employee={soleMemberEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={true}
        />
      );

      await user.selectOptions(screen.getByLabelText("担当役割"), "role-1");
      expect(await screen.findByRole("status")).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("担当役割"), "role-2");
      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });
    });

    test("唯一メンバーでなければ担当役割を変更しても警告は出ない", async () => {
      const user = userEvent.setup();
      render(
        <EmployeeUpdateForm
          employee={soleMemberEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      await user.selectOptions(screen.getByLabelText("担当役割"), "role-1");

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });
    });

    test("担当役割が未設定の従業員では変更しても警告は出ない", async () => {
      const user = userEvent.setup();
      render(
        <EmployeeUpdateForm
          employee={{ ...mockEmployee, assignedRoleId: null }}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      await user.selectOptions(screen.getByLabelText("担当役割"), "role-1");

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });
    });
  });

  describe("canUpdate=true の場合（編集モード）", () => {
    test("タイトルが「従業員変更」と表示される", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByText("従業員変更")).toBeInTheDocument();
    });

    test("更新ボタンが表示される", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
    });

    test("入力フィールドが有効になっている", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByLabelText("名前")).not.toBeDisabled();
      expect(screen.getByLabelText("メールアドレス")).not.toBeDisabled();
      expect(screen.getByLabelText("権限")).not.toBeDisabled();
    });
  });

  describe("canUpdate=false の場合（詳細表示モード）", () => {
    test("タイトルが「従業員詳細」と表示される", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={false}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByText("従業員詳細")).toBeInTheDocument();
    });

    test("更新ボタンが表示されない", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={false}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.queryByRole("button", { name: "更新" })).not.toBeInTheDocument();
    });

    test("入力フィールドが無効になっている", () => {
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={false}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      expect(screen.getByLabelText("名前")).toBeDisabled();
      expect(screen.getByLabelText("メールアドレス")).toBeDisabled();
      expect(screen.getByLabelText("権限")).toBeDisabled();
    });
  });

  describe("入力テスト", () => {
    test("ユーザーがフォームの値を変更できる", async () => {
      const user = userEvent.setup();
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      // 名前を変更
      const nameInput = screen.getByLabelText("名前");
      await user.clear(nameInput);
      await user.type(nameInput, "田中花子");
      expect(nameInput).toHaveValue("田中花子");

      // メールアドレスを変更
      const emailInput = screen.getByLabelText("メールアドレス");
      await user.clear(emailInput);
      await user.type(emailInput, "tanaka@example.com");
      expect(emailInput).toHaveValue("tanaka@example.com");
    });

    test("権限を変更できる", async () => {
      const user = userEvent.setup();
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      const roleSelect = screen.getByLabelText("権限");

      await user.selectOptions(roleSelect, USER_ROLES.ADMIN);
      expect(roleSelect).toHaveValue(USER_ROLES.ADMIN);

      await user.selectOptions(roleSelect, USER_ROLES.USER);
      expect(roleSelect).toHaveValue(USER_ROLES.USER);
    });
  });

  describe("サブミットテスト", () => {
    test("フォームを送信するとupdateEmployeeが呼び出される", async () => {
      const user = userEvent.setup();
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      // フォームを送信
      const submitButton = screen.getByRole("button", { name: "更新" });
      await act(async () => {
        await user.click(submitButton);
      });

      // updateEmployeeが呼び出されたことを確認（startTransitionによる非同期処理を待機）
      await waitFor(() => {
        expect(mockUpdateEmployee).toHaveBeenCalled();
      });
    });

    test("送信されたFormDataに正しい値が含まれている", async () => {
      const user = userEvent.setup();
      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      // 値を変更
      const nameInput = screen.getByLabelText("名前");
      await user.clear(nameInput);
      await user.type(nameInput, "田中花子");

      await user.selectOptions(screen.getByLabelText("権限"), USER_ROLES.ADMIN);

      // フォームを送信
      await act(async () => {
        await user.click(screen.getByRole("button", { name: "更新" }));
      });

      // updateEmployeeが呼び出されたことを確認（startTransitionによる非同期処理を待機）
      await waitFor(() => {
        expect(mockUpdateEmployee).toHaveBeenCalled();
      });

      // updateEmployeeの引数を検証
      // bind(null, employeeCd)により、引数は (employeeCd, prevState, formData) の順
      const callArgs = mockUpdateEmployee.mock.calls[0];

      // 最初の引数はbindされたemployeeCd
      expect(callArgs[0]).toBe("EMP000001");

      // FormDataは3番目の引数
      const formData = callArgs[2] as FormData;

      expect(formData.get("name")).toBe("田中花子");
      expect(formData.get("email")).toBe("yamada@example.com");
      expect(formData.get("role")).toBe(USER_ROLES.ADMIN);
    });
  });

  describe("楽観ロック（ADR-0039）", () => {
    test("編集画面表示時の version が hidden input としてフォームに含まれ、送信時に往復する", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      // hidden input が存在し、画面表示時の version を保持している
      const versionInput = container.querySelector('input[type="hidden"][name="version"]');
      expect(versionInput).not.toBeNull();
      expect(versionInput).toHaveValue("3");

      // 送信した FormData に version が含まれる（フォーム往復の契約）
      await act(async () => {
        await user.click(screen.getByRole("button", { name: "更新" }));
      });
      await waitFor(() => {
        expect(mockUpdateEmployee).toHaveBeenCalled();
      });
      const formData = mockUpdateEmployee.mock.calls[0][2] as FormData;
      expect(formData.get("version")).toBe("3");
    });
  });

  describe("エラー表示テスト", () => {
    test("全体エラーメッセージが表示される", async () => {
      const user = userEvent.setup();

      // Conform形式のエラーレスポンスを返すようにモック
      mockUpdateEmployee.mockResolvedValue({
        status: "error",
        error: {
          "": ["サーバーエラーが発生しました"],
        },
        initialValue: {},
      });

      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      // フォームを送信
      await act(async () => {
        await user.click(screen.getByRole("button", { name: "更新" }));
      });

      // エラーメッセージが表示されることを確認
      expect(await screen.findByText("サーバーエラーが発生しました")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    test("フィールドごとのバリデーションエラーが表示される", async () => {
      const user = userEvent.setup();

      // Conform形式のフィールドエラーを返すようにモック
      mockUpdateEmployee.mockResolvedValue({
        status: "error",
        error: {
          name: ["名前は2文字以上で入力してください"],
          email: ["このメールアドレスは既に使用されています"],
        },
        initialValue: {
          name: "田中花子",
          email: "tanaka@example.com",
        },
      });

      render(
        <EmployeeUpdateForm
          employee={mockEmployee}
          canUpdate={true}
          departmentSelectSlot={mockDepartmentSelectSlot}
          roleOptions={mockRoleOptions}
          isSoleMemberOfCurrentRole={false}
        />
      );

      // フォームを送信
      await act(async () => {
        await user.click(screen.getByRole("button", { name: "更新" }));
      });

      // updateEmployeeが呼び出されたことを確認
      await waitFor(() => {
        expect(mockUpdateEmployee).toHaveBeenCalled();
      });

      // 各フィールドのエラーメッセージが表示されることを確認
      expect(await screen.findByText("名前は2文字以上で入力してください")).toBeInTheDocument();
      expect(screen.getByText("このメールアドレスは既に使用されています")).toBeInTheDocument();
    });
  });
});
