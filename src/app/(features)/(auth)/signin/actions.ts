"use server";

import { signIn, type SignInResult } from "@server/shared/auth";
import { z } from "zod";
import { SigninFormSchema } from "./schema";

export type SigninActionResult =
  | { success: true }
  | {
      success: false;
      errors: {
        email?: string[];
        password?: string[];
        general?: string;
      };
    };

/**
 * サインイン Server Action
 */
export async function signinAction(
  _prevState: SigninActionResult,
  formData: FormData
): Promise<SigninActionResult> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  // バリデーション
  const validatedFields = SigninFormSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      success: false,
      errors: z.flattenError(validatedFields.error).fieldErrors,
    };
  }

  // 認証サービスでサインイン
  const result: SignInResult = await signIn({
    email: validatedFields.data.email,
    password: validatedFields.data.password,
  });

  if (!result.success) {
    return {
      success: false,
      errors: {
        general: result.error,
      },
    };
  }

  return { success: true };
}
