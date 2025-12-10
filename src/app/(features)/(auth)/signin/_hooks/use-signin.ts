"use client";

import { DEFAULT_CALLBACK_URL } from "@/app/(features)/(auth)/signin/consts";
import { SigninFormSchema } from "@/app/(features)/(auth)/signin/schema";
import { authClient } from "@/app/_lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

export type SigninFormErrors = {
  email?: string[];
  password?: string[];
  general?: string;
};

export function useSignin() {
  const router = useRouter();
  const [errors, setErrors] = useState<SigninFormErrors>({});
  const [pending, setPending] = useState(false);

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
        callbackURL: DEFAULT_CALLBACK_URL,
      },
      {
        onSuccess: () => {
          router.push(DEFAULT_CALLBACK_URL);
        },
      }
    );

    setPending(false);

    if (error) {
      setErrors({ general: error.message });
    }
  };

  return {
    errors,
    pending,
    handleSubmit,
  };
}
