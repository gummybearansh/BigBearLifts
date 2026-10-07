"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/lib/auth";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 8;

export async function authenticate(formData: FormData): Promise<{ error: string } | undefined> {
  const headerStore = headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  const key = `login:${ip}`;

  if (isRateLimited(key, LIMIT)) {
    return { error: "Too many attempts. Wait a few minutes." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Enter your password." };
  }

  try {
    await signIn("credentials", {
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      recordAttempt(key, WINDOW_MS);
      return { error: "Wrong password." };
    }
    if (error instanceof AuthError && error.cause instanceof CredentialsSignin) {
      recordAttempt(key, WINDOW_MS);
      return { error: "Wrong password." };
    }
    if (error instanceof AuthError) {
      return { error: "Could not sign in." };
    }
    throw error;
  }
}
