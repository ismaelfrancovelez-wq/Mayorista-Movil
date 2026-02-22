import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import crypto from "crypto";

export const dynamic = 'force-dynamic';

// Genera un code_verifier aleatorio y su code_challenge (PKCE)
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function GET() {
  try {
    const userId = cookies().get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const APP_ID = process.env.MERCADOPAGO_APP_ID;
    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL;

    if (!APP_ID || !BASE_URL) {
      console.error('❌ Variables faltantes:', { APP_ID: !!APP_ID, BASE_URL: !!BASE_URL });
      return NextResponse.json(
        { error: "Configuración incompleta del servidor" },
        { status: 500 }
      );
    }

    // ✅ Generar PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // ✅ Guardar code_verifier en Firestore para usarlo después en mp-connect
    await db.collection("manufacturers").doc(userId).set({
      mpOAuth: {
        codeVerifier,
        createdAt: new Date(),
      }
    }, { merge: true });

    const REDIRECT_URI = `${BASE_URL}/api/manufacturers/mp-callback`;

    const authUrl = new URL('https://auth.mercadopago.com.ar/authorization');
    authUrl.searchParams.set('client_id', APP_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('platform_id', 'mp');
    authUrl.searchParams.set('state', userId);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('🔗 URL de autorización generada con PKCE');

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Error generando URL de auth:", error);
    return NextResponse.json(
      { error: "Error al generar URL" },
      { status: 500 }
    );
  }
}