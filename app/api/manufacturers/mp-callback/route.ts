import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // formato: "userId:nonce"
    const error = searchParams.get('error');

    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL;

    if (error) {
      console.error('❌ Error de Mercado Pago:', error);
      return NextResponse.redirect(
        `${BASE_URL}/dashboard/fabricante/vinculacion-mp?error=${error}`
      );
    }

    if (!code || !state) {
      console.error('❌ Faltan parámetros:', { code: !!code, state: !!state });
      return NextResponse.redirect(
        `${BASE_URL}/dashboard/fabricante/vinculacion-mp?error=missing_params`
      );
    }

    // ✅ Parsear el state para obtener userId y nonce
    const [userId, stateNonce] = state.split(':');

    if (!userId || !stateNonce) {
      console.error('❌ State inválido:', state);
      return NextResponse.redirect(
        `${BASE_URL}/dashboard/fabricante/vinculacion-mp?error=invalid_state`
      );
    }

    // ✅ Recuperar mpOAuth de Firestore y validar el nonce
    const manufacturerDoc = await db.collection("manufacturers").doc(userId).get();
    const mpOAuth = manufacturerDoc.data()?.mpOAuth;

    if (!mpOAuth?.codeVerifier || !mpOAuth?.stateNonce) {
      console.error('❌ No se encontró mpOAuth en Firestore para userId:', userId);
      return NextResponse.redirect(
        `${BASE_URL}/dashboard/fabricante/vinculacion-mp?error=session_expired`
      );
    }

    // ✅ Validar que el nonce coincide (protección CSRF)
    if (mpOAuth.stateNonce !== stateNonce) {
      console.error('❌ Nonce inválido - posible ataque CSRF');
      return NextResponse.redirect(
        `${BASE_URL}/dashboard/fabricante/vinculacion-mp?error=invalid_state`
      );
    }

    console.log("🔄 Intercambiando código por access token con PKCE...");

    const REDIRECT_URI = `${BASE_URL}/api/manufacturers/mp-callback`;

    // ✅ Intercambio del código por token — todo server-side, nunca expuesto en URL
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
        redirect_uri: REDIRECT_URI,
        code_verifier: mpOAuth.codeVerifier, // ✅ PKCE
      }),
    });

    console.log("📡 Respuesta de Mercado Pago:", tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("❌ Error de Mercado Pago:", errorData);
      return NextResponse.redirect(
        `${BASE_URL}/dashboard/fabricante/vinculacion-mp?error=token_error`
      );
    }

    const tokenData = await tokenResponse.json();
    console.log("✅ Token obtenido exitosamente");

    // ✅ Calcular fecha de expiración real
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // ✅ Guardar token con fecha de expiración y limpiar datos temporales
    await db.collection("manufacturers").doc(userId).set({
      mercadopago: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        user_id: tokenData.user_id,
        public_key: tokenData.public_key,
        expires_at: expiresAt,
        connected_at: new Date(),
      },
      mpOAuth: null, // ✅ Limpiar datos temporales
      updatedAt: new Date(),
    }, { merge: true });

    console.log("✅ Datos guardados en Firestore");

    // ✅ Redirigir con success=true — el código NUNCA aparece en la URL
    return NextResponse.redirect(
      `${BASE_URL}/dashboard/fabricante/vinculacion-mp?success=true`
    );
  } catch (error) {
    console.error('Error en callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fabricante/vinculacion-mp?error=callback_error`
    );
  }
}