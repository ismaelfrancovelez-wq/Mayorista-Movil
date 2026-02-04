import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
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

    // Redirigir a la página de vinculación con el código
    return NextResponse.redirect(
      `${BASE_URL}/dashboard/fabricante/vinculacion-mp?code=${code}&state=${state}`
    );
  } catch (error) {
    console.error('Error en callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/fabricante/vinculacion-mp?error=callback_error`
    );
  }
}