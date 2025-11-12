import { CreateEmployeeCommand } from "@/subdomains/employee/commands/CreateEmployeeCommand";
import { PrismaEmployeeRepository } from "@/subdomains/employee/infra/prisma/PrismaEmployeeRepository";
import { PrismaEmployeeQueryService } from "@/subdomains/employee/infra/queries/PrismaEmployeeQueryService";
import { GetAllEmployeesQuery } from "@/subdomains/employee/queries/GetAllEmployeesQuery";
import { EmployeeCdDuplicationCheckDomainService } from "@/subdomains/employee/services/EmployeeCdDuplicationCheckDomainService";
import { hash } from "bcrypt";
import { revalidatePath } from "next/cache";

export default async function EmployeePage() {
  // データ取得（Query側）
  const queryService = new PrismaEmployeeQueryService();
  const getAllQuery = new GetAllEmployeesQuery(queryService);
  const employees = await getAllQuery.execute({});

  // Server Action: 従業員作成
  async function createEmployee(formData: FormData) {
    "use server";

    const email = formData.get("email") as string;
    const name = formData.get("name") as string;
    const employeeCd = formData.get("employeeCd") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as "ADMIN" | "USER";

    try {
      const repository = new PrismaEmployeeRepository();
      const employeeCdDuplicationCheck =
        new EmployeeCdDuplicationCheckDomainService(repository);

      const command = new CreateEmployeeCommand(
        repository,
        employeeCdDuplicationCheck
      );

      // パスワードをハッシュ化
      const passwordHash = await hash(password, 10);

      await command.execute({
        name,
        email,
        employeeCd,
        passwordHash,
        role,
      });

      revalidatePath("/employee");
    } catch (error) {
      console.error("Failed to create employee:", error);
      throw error;
    }
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">従業員管理</h1>

      {/* 作成フォーム */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4">新規従業員登録</h2>
        <form action={createEmployee} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              名前
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="山田太郎"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="yamada@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="employeeCd"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              従業員コード
            </label>
            <input
              type="text"
              id="employeeCd"
              name="employeeCd"
              required
              pattern="EMP[0-9]{6}"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="EMP000001"
            />
            <p className="text-gray-600 text-xs mt-1">
              形式: EMP + 6桁の数字（例: EMP000001）
            </p>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              パスワード
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              minLength={8}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="8文字以上"
            />
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              権限
            </label>
            <select
              id="role"
              name="role"
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="USER">一般ユーザー</option>
              <option value="ADMIN">管理者</option>
            </select>
          </div>

          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            登録
          </button>
        </form>
      </div>

      {/* 一覧表示 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 text-gray-500">
        <h2 className="text-xl font-semibold mb-4">従業員一覧</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-4 py-2 text-left">従業員コード</th>
                <th className="px-4 py-2 text-left">名前</th>
                <th className="px-4 py-2 text-left">メールアドレス</th>
                <th className="px-4 py-2 text-left">権限</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-4 text-center text-gray-500"
                  >
                    従業員が登録されていません
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="border-b hover:bg-gray-60">
                    <td className="px-4 py-2">{employee.employeeCd}</td>
                    <td className="px-4 py-2">{employee.name}</td>
                    <td className="px-4 py-2">{employee.email}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          employee.role === "ADMIN"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {employee.role === "ADMIN" ? "管理者" : "一般"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
