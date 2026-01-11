import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";
import { ShippingConfig } from "../../../../lib/types/shipping";

/* ===============================
   📍 BASE LOGÍSTICA (FIJA)
================================ */
const BASE_ADDRESS = {
  lat: -34.591058, // Poeta Romildo Risso 3244
  lng: -58.632046,
};

/* ===============================
   📐 DISTANCIA (Haversine)
================================ */
function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/* ===============================
   🚚 CALCULAR ENVÍO
================================ */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const productId = String(body.productId || "").trim();
    const retailerId = String(body.retailerId || "").trim();
    const qty = Number(body.qty);

    if (!productId || !retailerId || qty <= 0) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    /* ===============================
       📦 PRODUCTO
    =============================== */
    const productSnap = await db.collection("products").doc(productId).get();
    if (!productSnap.exists) {
      return NextResponse.json({ error: "Producto no existe" }, { status: 404 });
    }

    const product = productSnap.data()!;
    const minimumQuantity = Number(product.minimumQuantity);

    if (!minimumQuantity || isNaN(minimumQuantity)) {
      return NextResponse.json(
        { error: "minimumQuantity inválido" },
        { status: 500 }
      );
    }

    if (!product.factoryId) {
      return NextResponse.json(
        { error: "Producto sin factoryId" },
        { status: 500 }
      );
    }

    const shippingConfig = product.shippingConfig as ShippingConfig;

    /* ===============================
       👥 USUARIOS
    =============================== */
    const factorySnap = await db.collection("users").doc(product.factoryId).get();
    const retailerSnap = await db.collection("users").doc(retailerId).get();

    if (!factorySnap.exists || !retailerSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const factory = factorySnap.data()!;
    const retailer = retailerSnap.data()!;

    if (
      !factory.address?.lat ||
      !factory.address?.lng ||
      !retailer.address?.lat ||
      !retailer.address?.lng
    ) {
      return NextResponse.json(
        { error: "Direcciones incompletas" },
        { status: 400 }
      );
    }

    /* ===============================
       🟣 FRACCIONADO → BASE → FÁBRICA → REVENDEDOR → x2
    =============================== */
    if (qty < minimumQuantity) {
      const kmBaseFactory = distanceKm(BASE_ADDRESS, factory.address);
      const kmFactoryRetailer = distanceKm(factory.address, retailer.address);

      const totalKm = (kmBaseFactory + kmFactoryRetailer) * 2;
      const cost = totalKm * 85 + 3500;

      console.log("🟣 FRACCIONADO BASE", {
        kmBaseFactory,
        kmFactoryRetailer,
        totalKm,
        cost,
      });

      return NextResponse.json({
        shippingMode: "platform",
        shippingCost: Math.round(cost),
      });
    }

    /* ===============================
       🔵 COMPRA DIRECTA → FÁBRICA
    =============================== */
    if (shippingConfig?.shippingType === "own") {
      const own = shippingConfig.ownShipping;
      const km = distanceKm(factory.address, retailer.address);

      // 🟩 ZONAS POR KM
      if (own?.pricingModel === "zones_km" && own.kmZones) {
        const zone = km <= 10 ? "z1" : km <= 30 ? "z2" : "z3";

        return NextResponse.json({
          shippingMode: "factory",
          shippingCost: own.kmZones[zone],
        });
      }

      // 🟦 PRECIO POR KM
      if (
        own?.pricingModel === "km" &&
        typeof own.perKmRate === "number"
      ) {
        return NextResponse.json({
          shippingMode: "factory",
          shippingCost: Math.round(km * own.perKmRate),
        });
      }
    }

    return NextResponse.json(
      { error: "No se pudo calcular envío" },
      { status: 500 }
    );
  } catch (err) {
    console.error("SHIPPING ERROR:", err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}