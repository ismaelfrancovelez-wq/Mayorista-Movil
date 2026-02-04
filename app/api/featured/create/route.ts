import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { FeaturedType, FeaturedDuration, FEATURED_PRICES, FEATURED_SLOTS } from "../../../../lib/types/featured";
import { createPreference } from "../../../../lib/mercadopago";

export async function POST(req: Request) {
  try {
    const userId = cookies().get("userId")?.value;
    const role = cookies().get("activeRole")?.value;

    if (!userId || role !== "manufacturer") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { type, itemId, duration } = body as {
      type: FeaturedType;
      itemId: string;
      duration: FeaturedDuration;
    };

    if (!type || !["product", "factory"].includes(type)) {
      return NextResponse.json(
        { error: "Tipo inválido" },
        { status: 400 }
      );
    }

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId requerido" },
        { status: 400 }
      );
    }

    if (!duration || ![7, 15, 30].includes(duration)) {
      return NextResponse.json(
        { error: "Duración inválida (7, 15 o 30 días)" },
        { status: 400 }
      );
    }

    const activeCount = await db
      .collection("featured")
      .where("type", "==", type)
      .where("active", "==", true)
      .where("expired", "==", false)
      .count()
      .get();

    const maxSlots = FEATURED_SLOTS[type];
    
    if (activeCount.data().count >= maxSlots) {
      return NextResponse.json(
        { error: `No hay slots disponibles. Máximo: ${maxSlots}` },
        { status: 400 }
      );
    }

    let metadata: any = {};

    if (type === "product") {
      const productSnap = await db.collection("products").doc(itemId).get();
      
      if (!productSnap.exists) {
        return NextResponse.json(
          { error: "Producto no encontrado" },
          { status: 404 }
        );
      }

      const product = productSnap.data()!;
      
      if (product.factoryId !== userId) {
        return NextResponse.json(
          { error: "Este producto no te pertenece" },
          { status: 403 }
        );
      }

      metadata = {
        name: product.name,
        description: product.description || "",
        imageUrl: product.imageUrl || "",
      };
    } else {
      const factorySnap = await db.collection("manufacturers").doc(itemId).get();
      
      if (!factorySnap.exists) {
        return NextResponse.json(
          { error: "Fábrica no encontrada" },
          { status: 404 }
        );
      }

      if (itemId !== userId) {
        return NextResponse.json(
          { error: "Esta fábrica no te pertenece" },
          { status: 403 }
        );
      }

      const factory = factorySnap.data()!;

      metadata = {
        name: factory.businessName || factory.name || "Mi fábrica",
        description: factory.description || "",
        imageUrl: factory.imageUrl || "",
      };
    }

    const amount = FEATURED_PRICES[duration];

    const preference = await createPreference({
      title: `Destacar ${type === "product" ? "producto" : "fábrica"} por ${duration} días`,
      unit_price: amount,
      quantity: 1,
      metadata: {
        productId: "featured_payment",
        qty: 1,
        tipo: "destacado",
        withShipping: false,
        featuredType: type,
        featuredItemId: itemId,
        featuredDuration: duration,
      },
      back_urls: {
        success: process.env.NEXT_PUBLIC_APP_URL + "/dashboard/fabricante/destacados",
        pending: process.env.NEXT_PUBLIC_APP_URL + "/pending",
        failure: process.env.NEXT_PUBLIC_APP_URL + "/failure",
      },
    });

    if (!preference.init_point) {
      throw new Error("No se pudo crear preferencia de pago");
    }

    return NextResponse.json({
      init_point: preference.init_point,
      amount,
      duration,
    });

  } catch (error) {
    console.error("❌ CREATE FEATURED ERROR:", error);
    return NextResponse.json(
      { error: "Error al crear destacado" },
      { status: 500 }
    );
  }
}