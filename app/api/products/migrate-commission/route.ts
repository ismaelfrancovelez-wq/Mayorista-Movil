// app/api/products/migrate-commission/route.ts
// 🔧 ENDPOINT TEMPORAL DE MIGRACIÓN
// Convierte productos del formato viejo (price con 4% incluido)
// al formato nuevo (price base + displayPrice con 4%).
//
// Idempotente: si el producto ya tiene displayPrice, lo saltea.
// Solo procesa los productos del usuario logueado.
//
// 🗑️ ELIMINAR ESTE ARCHIVO una vez completada la migración.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const COMMISSION_RATE = 1.04;

export async function POST(req: Request) {
  try {
    const userId = cookies().get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar que sea seller
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
    }

    const userData = userSnap.data();
    const sellerRoles = ["manufacturer", "distributor", "wholesaler"];
    const userType = userData?.usertype;
    const activeRoleDB = userData?.activeRole;
    const roles = userData?.roles || [];

    const hasSellerRole =
      sellerRoles.includes(userType) ||
      sellerRoles.includes(activeRoleDB) ||
      roles.some((r: string) => sellerRoles.includes(r));

    if (!hasSellerRole) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // Body opcional: { dryRun: boolean }
    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dryRun === true;
    } catch {
      // No body, ok
    }

    // Traer todos los productos del usuario
    const productsSnap = await db
      .collection("products")
      .where("factoryId", "==", userId)
      .get();

    const stats = {
      total: productsSnap.size,
      migrated: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{
        id: string;
        name: string;
        action: "migrated" | "skipped" | "error";
        oldPrice?: number;
        newPrice?: number;
        newDisplayPrice?: number;
        reason?: string;
      }>,
    };

    for (const doc of productsSnap.docs) {
      const data = doc.data();
      const productId = doc.id;
      const name = data.name || "(sin nombre)";

      // Si ya tiene displayPrice, está migrado — saltear
      if (typeof data.displayPrice === "number") {
        stats.skipped++;
        stats.details.push({
          id: productId,
          name,
          action: "skipped",
          reason: "ya tiene displayPrice",
        });
        continue;
      }

      try {
        const oldPrice = Number(data.price);
        if (!oldPrice || oldPrice <= 0) {
          stats.errors++;
          stats.details.push({
            id: productId,
            name,
            action: "error",
            reason: "price inválido",
          });
          continue;
        }

        // Deshacer el 4%: el price actual es el "displayPrice" futuro
        const newDisplayPrice = Math.round(oldPrice);
        const newPrice = Math.round(oldPrice / COMMISSION_RATE);

        // Migrar minimums[].formats[]
        const oldMinimums = Array.isArray(data.minimums) ? data.minimums : [];
        const newMinimums = oldMinimums.map((m: any) => ({
          ...m,
          formats: Array.isArray(m.formats)
            ? m.formats.map((f: any) => {
                // Si el format ya tiene displayPrice, no lo tocamos
                if (typeof f.displayPrice === "number") return f;
                const oldFormatPrice = Number(f.price) || 0;
                return {
                  ...f,
                  price: Math.round(oldFormatPrice / COMMISSION_RATE),
                  displayPrice: Math.round(oldFormatPrice),
                };
              })
            : [],
        }));

        if (!dryRun) {
          await doc.ref.update({
            price: newPrice,
            displayPrice: newDisplayPrice,
            minimums: newMinimums,
            commissionMigratedAt: FieldValue.serverTimestamp(),
          });
        }

        stats.migrated++;
        stats.details.push({
          id: productId,
          name,
          action: "migrated",
          oldPrice,
          newPrice,
          newDisplayPrice,
        });
      } catch (err: any) {
        stats.errors++;
        stats.details.push({
          id: productId,
          name,
          action: "error",
          reason: err?.message || "error desconocido",
        });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      stats: {
        total: stats.total,
        migrated: stats.migrated,
        skipped: stats.skipped,
        errors: stats.errors,
      },
      details: stats.details,
    });
  } catch (error: any) {
    console.error("❌ MIGRATE COMMISSION ERROR:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error en migración" },
      { status: 500 }
    );
  }
}