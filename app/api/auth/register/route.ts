import { NextResponse } from "next/server";
import { db, auth } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const { idToken, usertype } = await req.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "Token requerido" },
        { status: 400 }
      );
    }

    // ✅ ACTUALIZADO: ahora acepta los 4 roles
    if (!usertype || !["manufacturer", "retailer", "distributor", "wholesaler"].includes(usertype)) {
      return NextResponse.json(
        { error: "Tipo de usuario inválido" },
        { status: 400 }
      );
    }

    // Verificar token
    const decoded = await auth.verifyIdToken(idToken);
    const userId = decoded.uid;
    const email = decoded.email;

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      // Usuario ya existe, solo actualizar activeRole
      await userRef.update({
        activeRole: usertype,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        userId,
        usertype,
        message: "Usuario actualizado",
      });
    }

    // Crear usuario nuevo
    await userRef.set({
      userId,
      email,
      usertype,
      activeRole: usertype,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Crear documento según el rol
    if (usertype === "manufacturer") {
      await db.collection("manufacturers").doc(userId).set({
        userId,
        email,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    if (usertype === "retailer") {
      await db.collection("retailers").doc(userId).set({
        userId,
        email,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // ✅ NUEVO: Crear documento para distribuidor
    if (usertype === "distributor") {
      await db.collection("distributors").doc(userId).set({
        userId,
        email,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // ✅ NUEVO: Crear documento para mayorista
    if (usertype === "wholesaler") {
      await db.collection("wholesalers").doc(userId).set({
        userId,
        email,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      userId,
      usertype,
      message: "Usuario registrado exitosamente",
    });

  } catch (err) {
    console.error("❌ REGISTER ERROR:", err);
    return NextResponse.json(
      { error: "Error al registrar usuario" },
      { status: 500 }
    );
  }
}