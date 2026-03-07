"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  defaultValues: {
    name: string;
    abbreviation: string;
    departmentCd: string;
    isActive: string;
  };
};

export function DepartmentSearchForm({ defaultValues }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [name, setName] = useState(defaultValues.name);
  const [abbreviation, setAbbreviation] = useState(defaultValues.abbreviation);
  const [departmentCd, setDepartmentCd] = useState(defaultValues.departmentCd);
  const [isActive, setIsActive] = useState(defaultValues.isActive);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();

    if (name.trim()) params.set("name", name.trim());
    if (abbreviation.trim()) params.set("abbreviation", abbreviation.trim());
    if (departmentCd.trim()) params.set("departmentCd", departmentCd.trim());
    if (isActive) params.set("isActive", isActive);

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleClear = () => {
    setName("");
    setAbbreviation("");
    setDepartmentCd("");
    setIsActive("");
    router.push(pathname);
  };

  return (
    <div className="bg-white shadow-md rounded px-8 pt-2 pb-4 mb-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">検索条件</h2>
      <form onSubmit={handleSearch}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="search-name" className="block text-gray-700 text-sm font-bold mb-2">
              部署名
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
              htmlFor="search-abbreviation"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              略称
            </label>
            <input
              id="search-abbreviation"
              type="text"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              placeholder="部分一致"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label
              htmlFor="search-departmentCd"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              部署コード
            </label>
            <input
              id="search-departmentCd"
              type="text"
              value={departmentCd}
              onChange={(e) => setDepartmentCd(e.target.value)}
              placeholder="完全一致"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="w-[140px]">
            <label htmlFor="search-isActive" className="block text-gray-700 text-sm font-bold mb-2">
              状態
            </label>
            <select
              id="search-isActive"
              value={isActive}
              onChange={(e) => setIsActive(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="">すべて</option>
              <option value="true">有効</option>
              <option value="false">無効</option>
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
