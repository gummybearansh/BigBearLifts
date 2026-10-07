import type { Metadata } from "next";
import { LoginForm } from "@/app/(auth)/login/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4.5rem,env(safe-area-inset-top))]">
      <div className="mb-10">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
          B
        </div>
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight">BigBearLifts</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the password for this install.</p>
      </div>
      <LoginForm />
    </div>
  );
}
