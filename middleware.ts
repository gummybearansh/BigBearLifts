import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const path = request.nextUrl.pathname;
  const loggedIn = Boolean(request.auth?.user);

  if (path === "/sw.js" || path === "/manifest.webmanifest" || path.startsWith("/icon")) {
    return NextResponse.next();
  }

  if (path.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  if (!loggedIn && path.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!loggedIn && path !== "/login") {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  if (loggedIn && path === "/login") {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
