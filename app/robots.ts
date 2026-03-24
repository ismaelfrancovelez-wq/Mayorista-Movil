// app/robots.ts
// Genera /robots.txt automáticamente
//
// Le dice a Google qué puede y qué no puede indexar.
// Sin esto Google pierde tiempo rastreando /dashboard, /api, /admin
// y puede penalizar el dominio por contenido detrás de auth.

import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Regla general para todos los bots
        userAgent: "*",
        allow: [
          "/",
          "/explorar",
          "/explorar/",       // productos individuales
          "/registro",
        ],
        disallow: [
          "/dashboard/",      // área privada de usuarios
          "/api/",            // endpoints internos
          "/admin/",          // panel de administración
          "/login",           // página de auth — no aporta SEO
          "/success",         // página post-pago
          "/failure",         // página post-pago
          "/pending",         // página post-pago
          "/test-payment",    // página de testing
        ],
      },
    ],
    // ✅ Referencia al sitemap para que Google lo encuentre fácil
    sitemap: "https://mayoristamovil.com/sitemap.xml",
  };
}