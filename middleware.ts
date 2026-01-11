import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const retailerId = req.cookies.get("retailerId")?.value;

  const isDashboard =
    req.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboard && !retailerId) {
    return NextResponse.redirect(
      new URL("/login", req.url)
    );
  }

  return NextResponse.next();
}

/* ===============================
   RUTAS PROTEGIDAS
=============================== */
export const config = {
  matcher: ["/dashboard/:path*"],
};