import { NextResponse } from "next/server";
import { createSplitPreference } from "../../../../lib/mercadopago-split";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import rateLimit from "../../../../lib/rate-limit";

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export const dynamic = 'force-dynamic'; // 🆕 AGREGADO

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             'unknown';
  
  try {
    await limiter.check(10, ip);
  } catch {
    return NextResponse.json(
      { error: "Demasiados intentos. Por favor, espera un minuto." },
      { status: 429 }
    );
  }

  try {
    // ✅ OBTENER USER ID DESDE COOKIE
    const userId = cookies().get("userId")?.value;
    
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { 
      title, 
      unitPrice, 
      originalQty, 
      orderType, 
      lotType, 
      productId, 
      shippingMode, 
      shippingCost = 0, 
      MF,
      commission = 0,
    } = body;

    if (!originalQty || !Number.isFinite(Number(originalQty)) || !unitPrice || unitPrice <= 0) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      return NextResponse.json({ error: "Configuración faltante" }, { status: 500 });
    }

    // ═══════════════════════════════════════════════════════════
    // OBTENER DATOS DEL PRODUCTO Y FABRICANTE
    // ═══════════════════════════════════════════════════════════
    const productSnap = await db.collection("products").doc(productId).get();
    if (!productSnap.exists) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const productData = productSnap.data()!;
    const factoryId = productData.factoryId;

    const factorySnap = await db.collection("manufacturers").doc(factoryId).get();
    const factoryData = factorySnap.data();
    const factoryMPUserId = factoryData?.mercadopago?.user_id || null;

    // 🆕 OBTENER EMAIL DEL USUARIO (RETAILER)
    const retailerSnap = await db.collection("retailers").doc(userId).get();
    const retailerData = retailerSnap.data();
    const payerEmail = retailerData?.email || "comprador@example.com";
    const payerName = retailerData?.businessName || retailerData?.contactFullName || "Comprador";

    // ═══════════════════════════════════════════════════════════
    // DETERMINAR TIPO DE PEDIDO
    // ═══════════════════════════════════════════════════════════
    const tipo = orderType === "fraccionada" ? "fraccionada" : "directa";
    const withShipping = shippingMode !== "pickup";

    // ═══════════════════════════════════════════════════════════
    // CALCULAR MONTOS
    // ═══════════════════════════════════════════════════════════
    const productTotal = unitPrice - (commission + shippingCost);

    // ═══════════════════════════════════════════════════════════
    // CREAR PREFERENCIA CON SPLIT
    // ═══════════════════════════════════════════════════════════
    const preference = await createSplitPreference({
      title,
      unit_price: Math.round(unitPrice),
      quantity: 1,
      
      metadata: {
        productId,
        qty: originalQty,
        tipo,
        withShipping,
        orderType,
        lotType,
        retailerId: userId, // ✅ USANDO userId de cookie
        original_qty: originalQty,
        MF,
        shippingCost,
        shippingMode,
        commission,
      },
      
      back_urls: {
        success: `${baseUrl}/success`,
        failure: `${baseUrl}/failure`,
        pending: `${baseUrl}/pending`,
      },
      
      // ✅ SPLIT DE PAGOS
      factoryMPUserId,
      shippingCost,
      productTotal,
      commission,
      
      // 🆕 AGREGAR PAYER
      payer: {
        email: payerEmail,
        name: payerName,
      },
    });

    return NextResponse.json({ init_point: preference.init_point });
  } catch (error: any) {
    console.error("Error MP:", error);
    return NextResponse.json({ error: "Error iniciando pago" }, { status: 500 });
  }
}