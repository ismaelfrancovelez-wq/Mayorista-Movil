// app/api/admin/verification/reject/route.ts

import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/auth/requireAdmin";
import { db } from "../../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ✅ Helper: obtiene la colección correcta según el sellerType
function getCollectionForRole(sellerType?: string): string {
  if (sellerType === "distributor") return "distributors";
  if (sellerType === "wholesaler") return "wholesalers";
  return "manufacturers";
}

export async function POST(req: Request) {
  try {
    // ✅ VERIFICAR QUE SEA ADMIN
    const adminId = await requireAdmin();

    const body = await req.json();
    const { verificationId, manufacturerId, rejectionReason } = body;

    if (!verificationId || !manufacturerId || !rejectionReason) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 400 }
      );
    }

    // 📋 OBTENER SOLICITUD
    const verificationRef = db.collection("verification_requests").doc(verificationId);
    const verificationSnap = await verificationRef.get();

    if (!verificationSnap.exists) {
      return NextResponse.json(
        { error: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    const verificationData = verificationSnap.data()!;

    // ❌ ACTUALIZAR SOLICITUD
    await verificationRef.update({
      status: "rejected",
      rejectionReason: rejectionReason.trim(),
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: adminId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ✅ CORREGIDO: escribir en la colección correcta según el sellerType de la solicitud
    const collection = getCollectionForRole(verificationData.sellerType);
    await db.collection(collection).doc(manufacturerId).update({
      "verification.status": "rejected",
      "verification.rejectionReason": rejectionReason.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`❌ Verificación rechazada: ${manufacturerId} [${collection}]`);
    console.log(`Motivo: ${rejectionReason}`);

    return NextResponse.json({
      success: true,
      message: "Verificación rechazada correctamente",
    });

  } catch (error: any) {
    console.error("❌ Error rechazando verificación:", error);
    
    if (error.message.includes("No autorizado")) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Error al rechazar verificación" },
      { status: 500 }
    );
  }
}