// app/api/manufacturers/verification/status/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../../lib/firebase-admin";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ✅ Helper: obtiene la colección correcta según el rol
function getCollectionForRole(role: string): string {
  if (role === "distributor") return "distributors";
  if (role === "wholesaler") return "wholesalers";
  return "manufacturers";
}

export async function GET() {
  try {
    const userId = cookies().get("userId")?.value;
    const role = cookies().get("activeRole")?.value || "manufacturer";

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // ✅ CORREGIDO: leer de la colección correcta según el rol activo
    const collection = getCollectionForRole(role);
    const snap = await db.collection(collection).doc(userId).get();

    if (!snap.exists) {
      return NextResponse.json({
        status: 'unverified',
        cuit: "",
        legalName: "",
        businessAddress: "",
      });
    }

    const data = snap.data();

    return NextResponse.json({
      status: data?.verification?.status || 'unverified',
      cuit: data?.verification?.cuit || "",
      legalName: data?.verification?.legalName || "",
      businessAddress: data?.verification?.businessAddress || "",
      verifiedAt: data?.verification?.verifiedAt?.toDate()?.toISOString() || null,
      rejectionReason: data?.verification?.rejectionReason || "",
    });

  } catch (error) {
    console.error("❌ Get verification status:", error);
    return NextResponse.json(
      { error: "Error obteniendo estado" },
      { status: 500 }
    );
  }
}