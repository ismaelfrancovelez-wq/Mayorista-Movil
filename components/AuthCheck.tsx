"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthCheck() {
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    // ✅ FIX ERROR 19a: Manejar pathname null de forma explícita
    const currentPath = pathname ?? "/";
    
    // ✅ FIX ERROR 19b: Agregar /registro, /explorar y /como-funciona a rutas públicas
    // Antes faltaban y podían causar redirecciones incorrectas a /login
    const publicPaths = [
      "/",
      "/login",
      "/registro",
      "/explorar",
      "/como-funciona",
      "/ayuda",
      "/success",
      "/failure",
      "/pending",
    ];

    // Verificar si la ruta actual es pública (exacta o por prefijo)
    const isPublicPath =
      publicPaths.includes(currentPath) ||
      currentPath.startsWith("/explorar"); // /explorar/[id] también es pública

    if (isPublicPath) {
      return;
    }

    // Solo verificar autenticación si estamos en una ruta protegida
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
        });
        
        if (!res.ok) {
          // ✅ Solo redirigir si estamos en ruta protegida
          if (currentPath.startsWith("/dashboard") || currentPath.startsWith("/admin")) {
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

    // ✅ FIX ERROR 19c: Eliminar el polling cada 5 minutos.
    // Era innecesario: /api/auth/me ya se llama en cada página protegida del server,
    // y el middleware también protege las rutas. El polling generaba peticiones
    // de Firestore constantes sin beneficio real.
    // Si en el futuro se necesita detección de sesión expirada en tiempo real,
    // la solución correcta sería un WebSocket o Server-Sent Events, no polling.

  }, [router, pathname]);
  
  return null;
}