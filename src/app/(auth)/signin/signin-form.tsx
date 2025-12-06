"use client";

import { SigninFormSchema } from "@/app/(auth)/signin/schema";
import { authClient } from "@/app/_lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

type FormErrors = {
  name?: string[];
  email?: string[];
  password?: string[];
  general?: string;
};

export function SigninForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);

  // TODO: hookとして分離する
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const rawData = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    // クライアントサイドバリデーション
    const validatedFields = SigninFormSchema.safeParse(rawData);

    if (!validatedFields.success) {
      setErrors(z.flattenError(validatedFields.error).fieldErrors);
      setPending(false);
      return;
    }

    // Better Auth でサインイン
    const { error } = await authClient.signIn.email(
      {
        email: validatedFields.data.email,
        password: validatedFields.data.password,
        callbackURL: "/employees",
      },
      {
        onSuccess: () => {
          router.push("/employees");
        },
        onError: (ctx) => {
          setErrors({ general: ctx.error.message });
        },
      }
    );

    setPending(false);

    if (error) {
      setErrors({ general: error.message });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email">メールアドレス</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="メールアドレス"
        />
      </div>
      {errors.email && <p>{errors.email}</p>}

      <div>
        <label htmlFor="password">パスワード</label>
        <input id="password" name="password" type="password" />
      </div>

      {errors.password && (
        <div>
          <p>パスワードは以下を含む必要があります：</p>
          <ul>
            {errors.password.map((error) => (
              <li key={error}>- {error}</li>
            ))}
          </ul>
        </div>
      )}

      {errors.general && <p style={{ color: "red" }}>{errors.general}</p>}

      <button disabled={pending} type="submit">
        サインイン
      </button>
    </form>
  );
}
