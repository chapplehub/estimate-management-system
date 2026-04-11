"use client";

import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useActionState } from "react";
import { signinAction } from "../actions";
import { SigninFormSchema } from "../schema";
import { Button } from "@/app/_components/shadcnui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/app/_components/shadcnui/card";
import { Input } from "@/app/_components/shadcnui/input";
import { Label } from "@/app/_components/shadcnui/label";
import { AlertCircle, Loader2, Lock, Mail } from "lucide-react";

export function SigninForm() {
  const [lastResult, formAction, isPending] = useActionState(signinAction, undefined);

  const [form, fields] = useForm({
    lastResult,
    defaultValue:
      process.env.NODE_ENV === "development"
        ? {
            email: process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL,
            password: process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD,
          }
        : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: SigninFormSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <h1 className="text-2xl font-bold leading-none">サインイン</h1>
        <CardDescription>メールアドレスとパスワードを入力してください</CardDescription>
      </CardHeader>
      <CardContent>
        {/* 全体エラー表示（認証失敗など） */}
        {form.errors && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2 mb-4"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{form.errors}</span>
          </div>
        )}

        <form {...getFormProps(form)} action={formAction} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={fields.email.id}>メールアドレス</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                {...getInputProps(fields.email, { type: "email" })}
                placeholder="example@company.com"
                className="pl-10"
                disabled={isPending}
              />
            </div>
            {fields.email.errors && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {fields.email.errors[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={fields.password.id}>パスワード</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                {...getInputProps(fields.password, { type: "password" })}
                placeholder="パスワードを入力"
                className="pl-10"
                disabled={isPending}
              />
            </div>
            {fields.password.errors && (
              <div className="text-sm text-destructive">
                <p className="flex items-center gap-1 mb-1">
                  <AlertCircle className="h-4 w-4" />
                  パスワードは以下を含む必要があります：
                </p>
                <ul className="list-disc list-inside ml-5 space-y-0.5">
                  {fields.password.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                サインイン中...
              </>
            ) : (
              "サインイン"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
