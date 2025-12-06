import * as z from "zod";

export const SigninFormSchema = z.object({
  name: z
    .string()
    .min(2, { error: "名前は2文字以上である必要があります。" })
    .trim(),
  email: z.email({ error: "有効なメールアドレスを入力してください。" }).trim(),
  password: z
    .string()
    .min(8, { error: "8文字以上である必要があります" })
    .regex(/[a-zA-Z]/, { error: "少なくとも1つの文字を含みます。" })
    .regex(/[0-9]/, { error: "少なくとも1つの数字を含みます。" })
    .regex(/[^a-zA-Z0-9]/, {
      error: "少なくとも1つの特殊文字を含みます。",
    })
    .trim(),
});
