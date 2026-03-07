import { SigninForm } from "@/app/(auth)/signin/_components/signin-form";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-muted p-4">
      <SigninForm />
    </div>
  );
}
