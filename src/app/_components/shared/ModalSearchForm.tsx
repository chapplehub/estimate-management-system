"use client";

import { useState } from "react";
import type { SearchFieldDef } from "@/app/_components/shared/SearchForm";

type Props = {
  fields: SearchFieldDef[];
  onSearch: (values: Record<string, string>) => void;
  isLoading?: boolean;
};

export function ModalSearchForm({ fields, onSearch, isLoading }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field.key] = "";
    }
    return initial;
  });

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const result: Record<string, string> = {};

    for (const field of fields) {
      const value = values[field.key] ?? "";
      if (field.type === "text") {
        const trimmed = value.trim();
        if (trimmed) result[field.key] = trimmed;
      } else {
        if (value) result[field.key] = value;
      }
    }

    onSearch(result);
  };

  const handleClear = () => {
    const cleared: Record<string, string> = {};
    for (const field of fields) {
      cleared[field.key] = "";
    }
    setValues(cleared);
  };

  return (
    <div className="pt-2 pb-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">検索条件</h2>
      <form onSubmit={handleSearch}>
        <div className="flex flex-wrap items-end gap-4">
          {fields.map((field) => {
            if (field.type === "text") {
              return (
                <div key={field.key} className="flex-1 min-w-[150px]">
                  <label
                    htmlFor={`modal-search-${field.key}`}
                    className="block text-gray-700 text-sm font-bold mb-2"
                  >
                    {field.label}
                  </label>
                  <input
                    id={`modal-search-${field.key}`}
                    type="text"
                    value={values[field.key] ?? ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  />
                </div>
              );
            }

            return (
              <div key={field.key} className="w-[140px]">
                <label
                  htmlFor={`modal-search-${field.key}`}
                  className="block text-gray-700 text-sm font-bold mb-2"
                >
                  {field.label}
                </label>
                <select
                  id={`modal-search-${field.key}`}
                  value={values[field.key] ?? ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value="">すべて</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
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
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "検索中..." : "検索"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
