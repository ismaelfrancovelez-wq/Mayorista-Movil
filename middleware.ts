import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const userId = req.cookies.get("userId")?.value;
  const role = req.cookies.get("activeRole")?.value;
  const path = req.nextUrl.pathname;

  // ✅ FIX ERROR 18: Redirigir a login si no está autenticado
  if (!userId && !path.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 🏭 Fabricante queriendo entrar a revendedor
  if (
    path.startsWith("/dashboard/pedidos-fraccionados") &&
    role !== "retailer"
  ) {
    return NextResponse.redirect(
      new URL("/dashboard/fabricante", req.url)
    );
  }

  // 🛒 Revendedor queriendo entrar a fabricante
  if (
    path.startsWith("/dashboard/fabricante") &&
    role !== "manufacturer"
  ) {
    return NextResponse.redirect(
      new URL("/dashboard/pedidos-fraccionados", req.url)
    );
  }

  return NextResponse.next();
}

/* ===============================
   RUTAS PROTEGIDAS
   ✅ FIX ERROR 18: Agregado /explorar
=============================== */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/explorar/:path*", // ✅ Ahora explorar requiere autenticación
  ],
};