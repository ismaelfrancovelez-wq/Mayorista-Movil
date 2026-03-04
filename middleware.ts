import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const userId = req.cookies.get("userId")?.value;
  const role = req.cookies.get("activeRole")?.value;
  const path = req.nextUrl.pathname;

  // ✅ Solo proteger rutas del dashboard
  const isProtectedRoute = path.startsWith("/dashboard");

  if (!userId && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // ✅ ACTUALIZADO: los 3 roles de vendedor pueden entrar al dashboard de fabricante
  const isSellerRole = role === "manufacturer" || role === "distributor" || role === "wholesaler";

  // 🏭 Vendedor (fabricante/distribuidor/mayorista) queriendo entrar a revendedor
  if (
    path.startsWith("/dashboard/pedidos-fraccionados") &&
    isSellerRole
  ) {
    return NextResponse.redirect(
      new URL("/dashboard/fabricante", req.url)
    );
  }

  // 🛒 Revendedor queriendo entrar a fabricante
  if (
    path.startsWith("/dashboard/fabricante") &&
    role === "retailer"
  ) {
    return NextResponse.redirect(
      new URL("/dashboard/pedidos-fraccionados", req.url)
    );
  }

  return NextResponse.next();
}

/* ===============================
   RUTAS PROTEGIDAS
   Solo el dashboard requiere autenticación.
   /explorar, /login, /registro, / son públicas.
=============================== */
export const config = {
  matcher: [
    "/dashboard/:path*",
  ],
};