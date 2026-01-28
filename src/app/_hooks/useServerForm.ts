"use client";

import { useForm, type DefaultValue } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { startTransition, useActionState } from "react";
import type { z } from "zod";

/**
 * useServerForm のオプション
 *
 * @template TSchema - Zodスキーマの型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UseServerFormOptions<TSchema extends z.ZodObject<any>> = {
  /** Server Action */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (prevState: any, formData: FormData) => Promise<any>;
  /** Zodスキーマ */
  schema: TSchema;
  /** フォームのデフォルト値（編集フォーム用） */
  defaultValue?: DefaultValue<z.infer<TSchema>>;
  /** バリデーションタイミング */
  shouldValidate?: "onSubmit" | "onBlur" | "onInput";
  /** 再バリデーションタイミング */
  shouldRevalidate?: "onSubmit" | "onBlur" | "onInput";
};

/**
 * Server Action対応のフォームフック
 *
 * React 19の自動フォームリセット問題を回避するため、
 * event.preventDefault() + startTransition を使用してフォーム送信を制御する。
 *
 * @see learning/react19-form-reset-conform.md
 *
 * @example
 * ```tsx
 * const { form, fields, isPending } = useServerForm({
 *   action: createEmployee,
 *   schema: createEmployeeSchema,
 *   shouldValidate: "onBlur",
 *   shouldRevalidate: "onInput",
 * });
 * ```
 */
export function useServerForm<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TSchema extends z.ZodObject<any>,
>({
  action,
  schema,
  defaultValue,
  shouldValidate = "onBlur",
  shouldRevalidate = "onInput",
}: UseServerFormOptions<TSchema>) {
  const [lastResult, formAction, isPending] = useActionState(action, undefined);

  const [form, fields] = useForm<z.infer<TSchema>>({
    lastResult,
    defaultValue,
    onSubmit(event, { formData }) {
      // React 19の自動フォームリセットを回避
      // ネイティブのフォーム送信をキャンセルし、手動でactionを呼び出す
      event.preventDefault();
      startTransition(() => {
        formAction(formData);
      });
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldValidate,
    shouldRevalidate,
  });

  return { form, fields, isPending };
}
