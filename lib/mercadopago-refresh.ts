// lib/mercadopago-refresh.ts
// Obtiene el access_token del fabricante y lo renueva automáticamente si está por vencer.

import { db } from "./firebase-admin";

/**
 * Retorna un access_token válido para el fabricante dado.
 * Si el token está por vencer (menos de 7 días), lo renueva automáticamente usando el refresh_token.
 * Usar esta función en cualquier lugar donde se necesite el token de un fabricante.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const doc = await db.collection("manufacturers").doc(userId).get();
  const mp = doc.data()?.mercadopago;

  if (!mp?.access_token) {
    throw new Error("El fabricante no tiene una cuenta de Mercado Pago conectada.");
  }

  const expiresAt: Date | undefined = mp.expires_at?.toDate?.();
  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // Si no hay fecha de expiración guardada o el token vence en menos de 7 días, renovar
  const shouldRefresh = !expiresAt || now >= new Date(expiresAt.getTime() - sevenDaysMs);

  if (shouldRefresh) {
    if (!mp.refresh_token) {
      throw new Error("El token expiró y no hay refresh_token disponible. El fabricante debe volver a vincular su cuenta.");
    }

    console.log(`🔄 Renovando access_token para fabricante ${userId}...`);

    const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.MERCADOPAGO_APP_ID,
        client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: mp.refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("❌ Error renovando token:", errorData);
      throw new Error("No se pudo renovar el access_token. El fabricante debe volver a vincular su cuenta.");
    }

    const newToken = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + newToken.expires_in * 1000);

    await db.collection("manufacturers").doc(userId).update({
      "mercadopago.access_token": newToken.access_token,
      "mercadopago.refresh_token": newToken.refresh_token,
      "mercadopago.expires_at": newExpiresAt,
      "updatedAt": new Date(),
    });

    console.log(`✅ Token renovado exitosamente para fabricante ${userId}`);
    return newToken.access_token;
  }

  return mp.access_token;
}