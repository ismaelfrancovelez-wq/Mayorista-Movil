// app/api/admin/verification/approve/route.ts

import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/auth/requireAdmin";
import { db } from "../../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    // ✅ VERIFICAR QUE SEA ADMIN
    const adminId = await requireAdmin();

    const body = await req.json();
    const { verificationId, manufacturerId } = body;

    if (!verificationId || !manufacturerId) {
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

    // ✅ ACTUALIZAR SOLICITUD
    await verificationRef.update({
      status: "verified",
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: adminId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ✅ ACTUALIZAR PERFIL DEL FABRICANTE
    await db.collection("manufacturers").doc(manufacturerId).set({
      verification: {
        status: "verified",
        verifiedAt: FieldValue.serverTimestamp(),
        legalName: verificationData.legalName,
        cuit: verificationData.cuit,
        taxType: verificationData.taxType,
        fantasyName: verificationData.fantasyName || null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // 📧 TODO: Enviar email de notificación al fabricante
    console.log(`✅ Verificación aprobada: ${manufacturerId}`);

    return NextResponse.json({
      success: true,
      message: "Verificación aprobada correctamente",
    });

  } catch (error: any) {
    console.error("❌ Error aprobando verificación:", error);
    
    if (error.message.includes("No autorizado")) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Error al aprobar verificación" },
      { status: 500 }
    );
  }
}