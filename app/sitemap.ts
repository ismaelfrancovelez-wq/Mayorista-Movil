// app/sitemap.ts
// Genera /sitemap.xml automáticamente en cada build
//
// Incluye:
//   - Páginas estáticas públicas que existen realmente
//   - Todos los productos activos de Firestore → /explorar/[productId]
//
// Google lo descubre vía /sitemap.xml y lo usa para indexar
// todas las páginas de producto sin necesidad de que estén linkeadas.
//
// revalidate = 86400 → se regenera una vez por día automáticamente.
// Si agregás una nueva página pública, añadila al array STATIC_ROUTES.

import { MetadataRoute } from "next";
import { db } from "../lib/firebase-admin";

export const revalidate = 86400; // 1 día

const BASE_URL = "https://mayoristamovil.com";

// ✅ Solo páginas que existen realmente como archivos en /app
// No incluyas rutas del footer que todavía no tienen page.tsx
const STATIC_ROUTES: MetadataRoute.Sitemap = [
  {
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1.0,
  },
  {
    url: `${BASE_URL}/explorar`,
    lastModified: new Date(),
    changeFrequency: "hourly", // cambia seguido — lotes nuevos, productos nuevos
    priority: 0.9,
  },
  {
    url: `${BASE_URL}/explorar/cerrando`,
    lastModified: new Date(),
    changeFrequency: "hourly",
    priority: 0.8,
  },
  {
    url: `${BASE_URL}/registro`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    // ✅ Solo productos activos — los inactivos no deben indexarse
    const snap = await db
      .collection("products")
      .where("active", "==", true)
      .select("updatedAt", "createdAt") // solo los campos necesarios, más barato
      .get();

    const productRoutes: MetadataRoute.Sitemap = snap.docs.map((doc) => {
      const data = doc.data();
      // Usa updatedAt si existe, createdAt como fallback, fecha actual como último recurso
      const lastMod =
        data.updatedAt?.toDate?.() ??
        data.createdAt?.toDate?.() ??
        new Date();

      return {
        url: `${BASE_URL}/explorar/${doc.id}`,
        lastModified: lastMod,
        changeFrequency: "daily" as const,
        priority: 0.7,
      };
    });

    return [...STATIC_ROUTES, ...productRoutes];

  } catch (error) {
    console.error("Error generando sitemap:", error);
    // Si Firestore falla, devuelve al menos las páginas estáticas
    return STATIC_ROUTES;
  }
}