"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { signinAction, type SigninActionResult } from "../actions";
import { DEFAULT_CALLBACK_URL } from "../consts";

export type SigninFormErrors = {
  email?: string[];
  password?: string[];
  general?: string;
};

const initialState: SigninActionResult = {
  success: false,
  errors: {},
};

export function useSignin() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(signinAction, initialState);

  // サインイン成功時にリダイレクト
  useEffect(() => {
    if (state.success) {
      router.push(DEFAULT_CALLBACK_URL);
    }
  }, [state.success, router]);

  const errors: SigninFormErrors = state.success ? {} : state.errors;

  return {
    errors,
    pending,
    formAction,
  };
}
