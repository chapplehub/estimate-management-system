"use client";

import { useSignin } from "@/app/(features)/(auth)/signin/_hooks/use-signin";
import { Button } from "@app/_components/shadcnui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@app/_components/shadcnui/card";
import { Input } from "@app/_components/shadcnui/input";
import { Label } from "@app/_components/shadcnui/label";
import { AlertCircle, Loader2, Lock, Mail } from "lucide-react";

export function SigninForm() {
  const { errors, pending, formAction } = useSignin();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">サインイン</CardTitle>
        <CardDescription>
          メールアドレスとパスワードを入力してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="example@company.com"
                className="pl-10"
                aria-invalid={errors.email ? "true" : "false"}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.email[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="パスワードを入力"
                className="pl-10"
                aria-invalid={errors.password ? "true" : "false"}
              />
            </div>
            {errors.password && (
              <div className="text-sm text-destructive">
                <p className="flex items-center gap-1 mb-1">
                  <AlertCircle className="h-4 w-4" />
                  パスワードは以下を含む必要があります：
                </p>
                <ul className="list-disc list-inside ml-5 space-y-0.5">
                  {errors.password.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {errors.general && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
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
