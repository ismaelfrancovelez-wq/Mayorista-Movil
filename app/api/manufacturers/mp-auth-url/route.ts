import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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

    // ✅ URL correcta de callback
    const REDIRECT_URI = `${BASE_URL}/api/manufacturers/mp-callback`;

    // ✅ Construir URL de autorización
    const authUrl = new URL('https://auth.mercadopago.com.ar/authorization');
    authUrl.searchParams.set('client_id', APP_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('platform_id', 'mp');
    authUrl.searchParams.set('state', userId);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);

    console.log('🔗 URL de autorización generada:', authUrl.toString());

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Error generando URL de auth:", error);
    return NextResponse.json(
      { error: "Error al generar URL" },
      { status: 500 }
    );
  }
}