import { NextResponse, type NextRequest } from "next/server";

// Anonymous per-visitor session: each browser gets a stable random ID so
// thread history and intelligence data are scoped per visitor instead of
// shared under a single "demo-user". Replace with real auth before storing
// any sensitive user data.
export const SESSION_COOKIE = "mettle_sid";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    response.cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
