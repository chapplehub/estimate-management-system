"use server";

import { signIn } from "@server/shared/auth";
import { parseWithZod } from "@conform-to/zod/v4";
import { redirect } from "next/navigation";
import { SigninFormSchema } from "./schema";
import { DEFAULT_CALLBACK_URL } from "./consts";

/**
 * サインイン Server Action
 *
 * Conformを使用してFormDataをバリデーションし、認証を行う。
 * 成功時はDEFAULT_CALLBACK_URLにリダイレクト。
 */
export async function signinAction(prevState: unknown, formData: FormData) {
  const submission = parseWithZod(formData, {
    schema: SigninFormSchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const { email, password } = submission.value;

  // 認証サービスでサインイン
  const result = await signIn({ email, password });

  if (!result.success) {
    // 認証エラーはformErrors（全体エラー）として返却
    return submission.reply({
      formErrors: [result.error],
    });
  }

  redirect(DEFAULT_CALLBACK_URL);
}
