"use client";

import { usePathname, useRouter } from "next/navigation";
import { Fragment, useState } from "react";

type TextFieldDef = {
  type: "text";
  key: string;
  label: string;
  placeholder?: string;
  className?: string;
  rowBreakBefore?: boolean;
};

type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldDef = {
  type: "select";
  key: string;
  label: string;
  options: SelectOption[];
  className?: string;
  rowBreakBefore?: boolean;
};

type MultiselectFieldDef = {
  type: "multiselect";
  key: string;
  label: string;
  options: SelectOption[];
  className?: string;
  rowBreakBefore?: boolean;
};

type DateFieldDef = {
  type: "date";
  key: string;
  label: string;
  className?: string;
  rowBreakBefore?: boolean;
};

type CheckboxFieldDef = {
  type: "checkbox";
  key: string;
  label: string;
  className?: string;
  rowBreakBefore?: boolean;
};

export type SearchFieldDef =
  | TextFieldDef
  | SelectFieldDef
  | MultiselectFieldDef
  | DateFieldDef
  | CheckboxFieldDef;

/** フィールド値の内部表現。multiselect のみ string[]、他は string（checkbox は "true"/""）。 */
type FieldValue = string | string[];

type Props = {
  fields: SearchFieldDef[];
  defaultValues: Record<string, FieldValue>;
};

/** checkbox の真値表現（URL パラメータにもこの文字列を載せる）。 */
const CHECKBOX_TRUE = "true";

export function SearchForm({ fields, defaultValues }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [values, setValues] = useState<Record<string, FieldValue>>(defaultValues);

  /** text/select/date/checkbox の値を string として読む（multiselect 以外は string で持つ）。 */
  const stringValue = (key: string): string => {
    const value = values[key];
    return typeof value === "string" ? value : "";
  };

  const handleChange = (key: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  /** multiselect の 1 option をトグルする。 */
  const toggleMulti = (key: string, optionValue: string) => {
    setValues((prev) => {
      const current = prev[key];
      const list = Array.isArray(current) ? current : [];
      const next = list.includes(optionValue)
        ? list.filter((v) => v !== optionValue)
        : [...list, optionValue];
      return { ...prev, [key]: next };
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();

    for (const field of fields) {
      const value = values[field.key];
      switch (field.type) {
        case "text": {
          const trimmed = (typeof value === "string" ? value : "").trim();
          if (trimmed) params.set(field.key, trimmed);
          break;
        }
        case "select":
        case "date": {
          if (typeof value === "string" && value) params.set(field.key, value);
          break;
        }
        case "multiselect": {
          const list = Array.isArray(value) ? value : [];
          // 繰り返しパラメータ（?key=A&key=B）として列挙する。
          for (const v of list) params.append(field.key, v);
          break;
        }
        case "checkbox": {
          if (value === CHECKBOX_TRUE) params.set(field.key, CHECKBOX_TRUE);
          break;
        }
      }
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleClear = () => {
    const cleared: Record<string, FieldValue> = {};
    for (const field of fields) {
      cleared[field.key] = field.type === "multiselect" ? [] : "";
    }
    setValues(cleared);
    router.push(pathname);
  };

  return (
    <div className="bg-white shadow-md rounded px-8 pt-2 pb-4 mb-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-500">検索条件</h2>
      <form onSubmit={handleSearch}>
        <div className="flex flex-wrap items-end gap-4">
          {fields.map((field) => {
            const rowBreak = field.rowBreakBefore ? <div className="basis-full h-0" /> : null;

            if (field.type === "text") {
              return (
                <Fragment key={field.key}>
                  {rowBreak}
                  <div className={field.className ?? "flex-1 min-w-[150px]"}>
                    <label
                      htmlFor={`search-${field.key}`}
                      className="block text-gray-700 text-sm font-bold mb-2"
                    >
                      {field.label}
                    </label>
                    <input
                      id={`search-${field.key}`}
                      type="text"
                      value={stringValue(field.key)}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>
                </Fragment>
              );
            }

            if (field.type === "select") {
              return (
                <Fragment key={field.key}>
                  {rowBreak}
                  <div className={field.className ?? "w-[140px]"}>
                    <label
                      htmlFor={`search-${field.key}`}
                      className="block text-gray-700 text-sm font-bold mb-2"
                    >
                      {field.label}
                    </label>
                    <select
                      id={`search-${field.key}`}
                      value={stringValue(field.key)}
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
                </Fragment>
              );
            }

            if (field.type === "date") {
              return (
                <Fragment key={field.key}>
                  {rowBreak}
                  <div className={field.className ?? "w-[160px]"}>
                    <label
                      htmlFor={`search-${field.key}`}
                      className="block text-gray-700 text-sm font-bold mb-2"
                    >
                      {field.label}
                    </label>
                    <input
                      id={`search-${field.key}`}
                      type="date"
                      value={stringValue(field.key)}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>
                </Fragment>
              );
            }

            if (field.type === "checkbox") {
              const checked = values[field.key] === CHECKBOX_TRUE;
              return (
                <Fragment key={field.key}>
                  {rowBreak}
                  <div className={field.className ?? "flex items-center h-[42px]"}>
                    <label className="flex items-center gap-2 text-gray-700 text-sm font-bold">
                      <input
                        id={`search-${field.key}`}
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          handleChange(field.key, e.target.checked ? CHECKBOX_TRUE : "")
                        }
                      />
                      {field.label}
                    </label>
                  </div>
                </Fragment>
              );
            }

            // multiselect
            const selected = Array.isArray(values[field.key])
              ? (values[field.key] as string[])
              : [];
            return (
              <Fragment key={field.key}>
                {rowBreak}
                <div className={field.className ?? "min-w-[150px]"}>
                  <span className="block text-gray-700 text-sm font-bold mb-2">{field.label}</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {field.options.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-1 text-gray-700 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(option.value)}
                          onChange={() => toggleMulti(field.key, option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
              </Fragment>
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
