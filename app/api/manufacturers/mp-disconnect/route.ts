import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST() {
  try {
    const userId = cookies().get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    await db.collection("manufacturers").doc(userId).update({
      mercadopago: FieldValue.delete(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error desconectando MP:", error);
    return NextResponse.json(
      { error: "Error al desvincular" },
      { status: 500 }
    );
  }
}