"use client";

import { USER_ROLES } from "@server/shared/auth/types";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  defaultValues: {
    name: string;
    email: string;
    employeeCd: string;
    role: string;
  };
};

export function EmployeeSearchForm({ defaultValues }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // フォーム状態管理
  const [name, setName] = useState(defaultValues.name);
  const [email, setEmail] = useState(defaultValues.email);
  const [employeeCd, setEmployeeCd] = useState(defaultValues.employeeCd);
  const [role, setRole] = useState(defaultValues.role);

  // 検索実行
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();

    // 空でない値のみURLに追加
    if (name.trim()) params.set("name", name.trim());
    if (email.trim()) params.set("email", email.trim());
    if (employeeCd.trim()) params.set("employeeCd", employeeCd.trim());
    if (role) params.set("role", role);

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  // クリア
  const handleClear = () => {
    setName("");
    setEmail("");
    setEmployeeCd("");
    setRole("");
    router.push(pathname);
  };

  return (
    <div className="bg-white shadow-md rounded px-8 pt-2 pb-4 mb-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">検索条件</h2>
      <form onSubmit={handleSearch}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="search-name" className="block text-gray-700 text-sm font-bold mb-2">
              名前
            </label>
            <input
              id="search-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="部分一致"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label
              htmlFor="search-employeeCd"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              従業員コード
            </label>
            <input
              id="search-employeeCd"
              type="text"
              value={employeeCd}
              onChange={(e) => setEmployeeCd(e.target.value)}
              placeholder="完全一致"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="search-email" className="block text-gray-700 text-sm font-bold mb-2">
              メールアドレス
            </label>
            <input
              id="search-email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="部分一致"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="w-[140px]">
            <label htmlFor="search-role" className="block text-gray-700 text-sm font-bold mb-2">
              権限
            </label>
            <select
              id="search-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="">すべて</option>
              <option value={USER_ROLES.USER}>一般ユーザー</option>
              <option value={USER_ROLES.ADMIN}>管理者</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              クリア
            </button>
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              検索
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
