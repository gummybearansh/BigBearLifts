import type { Metadata } from "next";
import { LoginForm } from "@/app/(auth)/login/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4.5rem,env(safe-area-inset-top))]">
      <div className="mb-10">
        <span className="relative mb-6 block size-12 overflow-hidden rounded-2xl bg-[#0A0A0B]">
          <img src="/mark.png" alt="" className="absolute left-1/2 top-1/2 h-[175%] w-[175%] max-w-none -translate-x-1/2 -translate-y-1/2" />
        </span>
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight">BigBearLifts</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the password for this install.</p>
      </div>
      <LoginForm />
    </div>
  );
}
