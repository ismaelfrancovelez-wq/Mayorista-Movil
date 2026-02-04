// app/api/admin/verification/reject/route.ts

import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/auth/requireAdmin";
import { db } from "../../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

    // ❌ ACTUALIZAR SOLICITUD
    await verificationRef.update({
      status: "rejected",
      rejectionReason: rejectionReason.trim(),
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: adminId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ❌ ACTUALIZAR PERFIL DEL FABRICANTE
    await db.collection("manufacturers").doc(manufacturerId).update({
      "verification.status": "rejected",
      "verification.rejectionReason": rejectionReason.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 📧 TODO: Enviar email de notificación al fabricante con el motivo
    console.log(`❌ Verificación rechazada: ${manufacturerId}`);
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