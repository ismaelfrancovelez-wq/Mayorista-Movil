"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthCheck() {
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    // ✅ FIX: Manejar pathname null de forma explícita
    const currentPath = pathname ?? "/";
    
    // ✅ No verificar en páginas públicas
    const publicPaths = ["/", "/login", "/success", "/failure", "/pending"];
    if (publicPaths.includes(currentPath)) {
      return;
    }

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
        });
        
        if (!res.ok) {
          // ✅ Solo redirigir si estamos en ruta protegida
          if (currentPath.startsWith("/dashboard") || currentPath.startsWith("/explorar")) {
            console.log("⚠️ Sesión expirada, redirigiendo a login...");
            router.push("/login");
          }
        }
      } catch (error) {
        console.error("Error verificando autenticación:", error);
        // No redirigir en caso de error de red para evitar loop
      }
    }
    
    // ✅ Verificar al montar
    checkAuth();
    
    // ✅ Verificar cada 5 minutos
    const interval = setInterval(checkAuth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [router, pathname]);
  
  return null;
}