// app/api/manufacturers/verification/status/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../../lib/firebase-admin";

export async function GET() {
  try {
    const userId = cookies().get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Obtener info del fabricante
    const manufacturerSnap = await db
      .collection("manufacturers")
      .doc(userId)
      .get();

    if (!manufacturerSnap.exists) {
      return NextResponse.json({
        status: 'unverified',
        cuit: "",
        legalName: "",
        businessAddress: "",
      });
    }

    const data = manufacturerSnap.data();

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