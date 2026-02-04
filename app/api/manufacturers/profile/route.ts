// app/api/manufacturers/profile/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/* ===============================
   GET → OBTENER PERFIL COMPLETO
================================ */
export async function GET() {
  try {
    const userId = cookies().get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const snap = await db
      .collection("manufacturers")
      .doc(userId)
      .get();

    if (!snap.exists) {
      return NextResponse.json({
        address: null,
        businessName: "",
        phone: "",
        email: "",
        schedule: null,
        profileImageUrl: "",
      });
    }

    const data = snap.data();

    return NextResponse.json({
      address: data?.address ?? null,
      businessName: data?.businessName ?? "",
      phone: data?.phone ?? "",
      email: data?.email ?? "",
      schedule: data?.schedule ?? null,
      profileImageUrl: data?.profileImageUrl ?? "",
    });
  } catch (error) {
    console.error("❌ Get profile:", error);
    return NextResponse.json(
      { error: "Error obteniendo perfil" },
      { status: 500 }
    );
  }
}

/* ===============================
   POST → GUARDAR PERFIL COMPLETO
================================ */
export async function POST(req: Request) {
  try {
    const userId = cookies().get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      address,
      businessName,
      phone,
      email,
      schedule,
      profileImageUrl,
    } = body;

    // ✅ Validaciones
    if (
      !address ||
      !address.formattedAddress ||
      typeof address.lat !== "number" ||
      typeof address.lng !== "number"
    ) {
      return NextResponse.json(
        { error: "Dirección inválida" },
        { status: 400 }
      );
    }

    if (!businessName || typeof businessName !== "string") {
      return NextResponse.json(
        { error: "Nombre de empresa obligatorio" },
        { status: 400 }
      );
    }

    // ✅ Guardar todo junto
    await db
      .collection("manufacturers")
      .doc(userId)
      .set(
        {
          address,
          businessName,
          phone: phone || null,
          email: email || null,
          schedule: schedule || null,
          profileImageUrl: profileImageUrl || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Save profile:", error);
    return NextResponse.json(
      { error: "Error guardando perfil" },
      { status: 500 }
    );
  }
}