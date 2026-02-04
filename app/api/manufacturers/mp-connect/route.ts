import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const userId = cookies().get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { code } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: "Código de autorización requerido" },
        { status: 400 }
      );
    }

    console.log("🔄 Intercambiando código por access token...");

    // 🔧 FIX: redirect_uri debe coincidir con el usado en mp-auth-url
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/manufacturers/mp-callback`;

    // Intercambiar código por access_token
    const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.MERCADOPAGO_APP_ID,
        client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI, // 🔧 Ahora usa la URL correcta
      }),
    });

    console.log("📡 Respuesta de Mercado Pago:", tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("❌ Error de Mercado Pago:", errorData);
      throw new Error(`Error al obtener access token: ${JSON.stringify(errorData)}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("✅ Token obtenido exitosamente");

    // Guardar en Firestore
    await db.collection("manufacturers").doc(userId).set({
      mercadopago: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        user_id: tokenData.user_id,
        public_key: tokenData.public_key,
        connected_at: new Date(),
      },
      updatedAt: new Date(),
    }, { merge: true });

    console.log("✅ Datos guardados en Firestore");

    return NextResponse.json({
      success: true,
      email: tokenData.email || null,
    });
  } catch (error: any) {
    console.error("❌ Error conectando MP:", error);
    return NextResponse.json(
      { error: error.message || "Error al conectar cuenta" },
      { status: 500 }
    );
  }
}