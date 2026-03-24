"use client";

import { cn } from "@/app/_lib/utils";
import type { SelectOption } from "./types";

export type SelectFieldProps = {
  /** 選択肢のリスト */
  options: SelectOption[];

  /** フィールド名 */
  name: string;

  /** フィールドID */
  id?: string;

  /** 初期選択値 */
  defaultValue?: string;

  /** プレースホルダー */
  placeholder?: string;

  /** 無効化 */
  disabled?: boolean;

  /** 必須 */
  required?: boolean;

  /** エラー状態 */
  "aria-invalid"?: boolean;

  /** エラーメッセージID */
  "aria-describedby"?: string;

  /** 追加クラス */
  className?: string;
};

/**
 * 汎用セレクトボックスコンポーネント
 *
 * DBテーブルから取得したデータをセレクトボックスで表示する。
 * Conform との連携にも対応。
 */
export function SelectField({
  options,
  name,
  id,
  defaultValue = "",
  placeholder = "選択してください",
  disabled = false,
  required = true,
  className,
  ...rest
}: SelectFieldProps) {
  const baseClassName =
    "shadow appearance-none border rounded w-full py-2 px-3 " +
    "text-gray-700 leading-tight focus:outline-none focus:shadow-outline " +
    "disabled:bg-gray-100";

  return (
    <select
      name={name}
      id={id ?? name}
      defaultValue={defaultValue}
      disabled={disabled}
      required={required}
      className={cn(baseClassName, className)}
      {...rest}
    >
      <option value="" disabled={required}>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
