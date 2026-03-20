// app/api/stats/public/route.ts
// Devuelve contadores públicos reales desde Firestore
// Cacheado 1 hora para no martillar la base de datos

import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";

export const revalidate = 3600; // 1 hora de cache

export async function GET() {
  try {
    // ✅ Las 3 queries corren en paralelo — no secuencial
    const [lotsSnap, usersSnap, manufacturersSnap] = await Promise.all([
      // Lotes completados
      db.collection("lots")
        .where("status", "==", "completed")
        .count()
        .get(),

      // Usuarios registrados (revendedores)
      db.collection("users")
        .count()
        .get(),

      // Fábricas verificadas
      db.collection("manufacturers")
        .where("verification.status", "==", "verified")
        .count()
        .get(),
    ]);

    const lotsCompleted   = lotsSnap.data().count     ?? 0;
    const totalUsers      = usersSnap.data().count     ?? 0;
    const verifiedFactories = manufacturersSnap.data().count ?? 0;

    return NextResponse.json(
      { lotsCompleted, totalUsers, verifiedFactories },
      {
        status: 200,
        headers: {
          // Cache en el navegador y en Vercel Edge
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("Error cargando stats públicas:", error);
    // Si falla Firestore, devolvemos valores mínimos en vez de romper la home
    return NextResponse.json(
      { lotsCompleted: 0, totalUsers: 0, verifiedFactories: 0 },
      { status: 200 }
    );
  }
}