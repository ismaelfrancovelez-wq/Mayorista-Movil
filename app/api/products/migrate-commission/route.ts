// app/api/products/migrate-commission/route.ts
//
// ✅ BLOQUE F — CLEANUP FINAL
// Borra el campo `displayPrice` de todos los productos y de cada
// `minimums[].formats[]`. Después de esto la DB queda con solo `price` BASE.
//
// Es idempotente: corrida después de la primera vez, no hace nada porque
// ya no hay campos `displayPrice`.
//
// Modo dry-run: ?dryRun=true para ver cuántos productos se afectarían.
//
// Solo accesible para admin (cookies userId === ADMIN_USER_ID).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos para procesar todos los productos

// ⚠️ AJUSTAR: poné acá el userId de admin si querés restringir el endpoint.
// Si lo dejás vacío, cualquier usuario logueado puede ejecutarlo.
const ADMIN_USER_IDS: string[] = []; // ej: ["abc123XYZ"]

export async function POST(req: Request) {
  try {
    const userId = cookies().get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json({ error: "Solo admins" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "true";

    console.log(`🧹 BLOQUE F: cleanup de displayPrice — dryRun=${dryRun}`);

    const productsSnap = await db.collection("products").get();
    console.log(`📦 Total de productos en DB: ${productsSnap.size}`);

    let total = 0;
    let willClean = 0;
    let alreadyClean = 0;
    let cleaned = 0;
    let errors = 0;
    const errorIds: string[] = [];

    // Procesamos en chunks de 50 con pequeño delay entre chunks
    // para no saturar Firestore.
    const docs = productsSnap.docs;
    const CHUNK_SIZE = 50;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);

      await Promise.all(chunk.map(async (doc) => {
        total++;
        const data = doc.data();

        // ¿Tiene displayPrice a nivel raíz?
        const hasRootDisplayPrice = "displayPrice" in data;

        // ¿Tiene displayPrice en alguno de los formats?
        const minimums = Array.isArray(data.minimums) ? data.minimums : [];
        const hasFormatDisplayPrice = minimums.some((m: any) =>
          Array.isArray(m.formats) && m.formats.some((f: any) => "displayPrice" in f)
        );

        if (!hasRootDisplayPrice && !hasFormatDisplayPrice) {
          alreadyClean++;
          return;
        }

        willClean++;

        if (dryRun) {
          // Solo contar, no modificar
          return;
        }

        // ── Aplicar cleanup ──
        try {
          // Para borrar dentro de array no podemos usar FieldValue.delete().
          // Tenemos que reescribir el array completo sin el campo displayPrice.
          const cleanedMinimums = minimums.map((m: any) => ({
            ...m,
            formats: Array.isArray(m.formats)
              ? m.formats.map((f: any) => {
                  // Copia f sin displayPrice
                  const { displayPrice, ...rest } = f;
                  return rest;
                })
              : m.formats,
          }));

          const updates: any = {
            minimums: cleanedMinimums,
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (hasRootDisplayPrice) {
            updates.displayPrice = FieldValue.delete();
          }

          await doc.ref.update(updates);
          cleaned++;
        } catch (err: any) {
          errors++;
          errorIds.push(doc.id);
          console.error(`❌ Error limpiando ${doc.id}:`, err?.message || err);
        }
      }));

      // Pequeño delay entre chunks (evita rate limit)
      if (i + CHUNK_SIZE < docs.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      console.log(`  Progreso: ${Math.min(i + CHUNK_SIZE, docs.length)}/${docs.length}`);
    }

    const result = {
      success: true,
      dryRun,
      total,
      alreadyClean,
      willClean: dryRun ? willClean : undefined,
      cleaned: dryRun ? undefined : cleaned,
      errors,
      errorIds: errors > 0 ? errorIds : undefined,
      message: dryRun
        ? `[DRY RUN] Se limpiarían ${willClean} productos. ${alreadyClean} ya están limpios.`
        : `✅ Cleanup completado. Limpiados: ${cleaned}. Ya limpios: ${alreadyClean}. Errores: ${errors}.`,
    };

    console.log("📊 Resultado final:", result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("❌ Error general en cleanup:", error);
    return NextResponse.json(
      { error: error?.message || "Error en cleanup" },
      { status: 500 }
    );
  }
}