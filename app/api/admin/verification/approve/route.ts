// app/api/admin/verification/approve/route.ts

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

    // ✅ CORREGIDO: escribir en la colección correcta según el sellerType de la solicitud
    const collection = getCollectionForRole(verificationData.sellerType);
    await db.collection(collection).doc(manufacturerId).set({
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

    console.log(`✅ Verificación aprobada: ${manufacturerId} [${collection}]`);

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