// app/api/webhooks/mercadopago/route.ts
// VERSIÓN CORREGIDA - Obtiene emails reales de Firebase Auth

import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { addFraccionadoToLot, FraccionatedLot } from "../../../../lib/lots";
import { createOrderFromClosedLot } from "../../../../lib/orders";
import rateLimit from "../../../../lib/rate-limit";
import { calculatePickupDeadline } from "../../../../lib/business-hours";
import {
  notifyManufacturerDirectOrder,
  notifyManufacturerLotClosed,
  notifyManufacturerFractionalProgress,
  notifyRetailerPickup,
} from "../../../../lib/notifications/send";
import admin from "firebase-admin";

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 1000,
});

const DEFAULT_SCHEDULE = {
  monday: { open: "09:00", close: "18:00" },
  tuesday: { open: "09:00", close: "18:00" },
  wednesday: { open: "09:00", close: "18:00" },
  thursday: { open: "09:00", close: "18:00" },
  friday: { open: "09:00", close: "18:00" },
  saturday: { open: "09:00", close: "13:00" },
  sunday: null,
};

type MPMetadata = {
  orderType?: string;
  order_type?: string;
  productId?: string;
  product_id?: string;
  retailerId?: string;
  retailer_id?: string;
  original_qty?: number;
  minimumOrder?: number;
  MF?: number;
  mf?: number;
  lotType?: string;
  lot_type?: string;
  shippingCost?: number;
  shippingMode?: string;
  tipo?: string;
  commission?: number;
  featuredType?: "product" | "factory";
  featuredItemId?: string;
  featuredDuration?: number;
};

// 🔧 FUNCIÓN NUEVA: Obtener email real de Firebase Auth
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const userRecord = await admin.auth().getUser(userId);
    console.log(`✅ Email obtenido para ${userId}:`, userRecord.email);
    return userRecord.email || null;
  } catch (error) {
    console.error(`⚠️ No se pudo obtener email para userId ${userId}:`, error);
    return null;
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok",
    message: "Webhook activo"
  });
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             'mercadopago';
  
  try {
    await limiter.check(100, ip);
  } catch {
    console.warn("⚠️ Rate limit alcanzado en webhook, pero procesando igual");
  }

  try {
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
    const topic = url.searchParams.get("type") || url.searchParams.get("topic");

    if (!paymentId || topic !== "payment") {
      return NextResponse.json({ received: true });
    }

    const paymentRef = db.collection("payments").doc(paymentId.toString());
    const quickCheck = await paymentRef.get();
    
    if (quickCheck.exists && quickCheck.data()?.appliedToLot === true) {
      return NextResponse.json({ received: true });
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const paymentApi = new Payment(client);
    
    const alreadyProcessed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(paymentRef);
      if (snap.exists && snap.data()?.appliedToLot === true) {
        return true;
      }
      
      const payment = await paymentApi.get({ id: paymentId });
      
      if (payment.status !== "approved") {
        return true;
      }
      
      tx.set(paymentRef, {
        processing: true,
        appliedToLot: true,
        status: payment.status,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return false;
    });

    if (alreadyProcessed) {
      return NextResponse.json({ received: true });
    }

    const payment = await paymentApi.get({ id: paymentId });
    const m = (payment.metadata as MPMetadata) || {};

    // ✅ DESTACADOS
    if (m.tipo === "destacado" && m.featuredType && m.featuredItemId && m.featuredDuration) {
      await processFeaturedPayment({
        paymentId: paymentId.toString(),
        type: m.featuredType,
        itemId: m.featuredItemId,
        duration: m.featuredDuration as 7 | 15 | 30,
        payment,
      });

      return NextResponse.json({ received: true });
    }

    // ✅ NORMALIZAR DATOS
    let orderType = m.orderType || m.order_type;
    if (orderType === "fraccionada") orderType = "fractional";
    if (orderType === "directa") orderType = "direct";

    const productId = m.productId || m.product_id;
    const retailerId = m.retailerId || m.retailer_id || "";
    const qty = Number(m.original_qty);
    const minimumOrder = Number(m.minimumOrder || 0);
    
    let lotType = m.lotType || m.lot_type;
    if (lotType === "fraccionado_retiro") lotType = "fractional_pickup";
    if (lotType === "fraccionado_envio") lotType = "fractional_shipping";

    if (!lotType && orderType === "fractional") {
      console.error("❌ lotType faltante para pedido fraccionado");
      return NextResponse.json({ received: true });
    }

    if (!orderType || !productId || !Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ received: true });
    }

    const productSnap = await db.collection("products").doc(productId).get();
    if (!productSnap.exists) {
      return NextResponse.json({ received: true });
    }

    const productData = productSnap.data()!;
    const factoryId = productData.factoryId;
    const netProfitPerUnit = productData.netProfitPerUnit || 0;
    const productProfit = netProfitPerUnit * qty;

    // ✅✅✅ CALCULAR SPLIT DE PAGOS ✅✅✅
    const totalAmount = payment.transaction_amount || 0;
    const shippingCost = m.shippingCost || 0;
    const commission = m.commission || 0;
    
    const productTotal = orderType === "fractional"
      ? totalAmount - commission - shippingCost
      : totalAmount - shippingCost;

    const factoryReceives = orderType === "direct"
      ? totalAmount
      : productTotal;

    const platformReceives = orderType === "fractional"
      ? commission + shippingCost
      : 0;

    // ✅✅✅ GUARDAR PAGO CON SPLIT INFO ✅✅✅
    await paymentRef.set({
      status: payment.status,
      orderType,
      isFraccionado: orderType === "fractional",
      productId,
      retailerId,
      factoryId,
      qty,
      minimumOrder,
      lotType,
      netProfitPerUnit,
      productProfit,
      settled: orderType !== "fractional",
      refundable: orderType === "fractional",
      
      splitPayment: {
        total: totalAmount,
        productTotal: Math.round(productTotal),
        commission: Math.round(commission),
        shippingCost: Math.round(shippingCost),
        factoryReceives: Math.round(factoryReceives),
        platformReceives: Math.round(platformReceives),
        splitType: orderType === "direct" ? "all_to_factory" : "split_commission",
      },
      
      updatedAt: FieldValue.serverTimestamp(),
      raw: payment,
    }, { merge: true });

    // ✅ OBTENER DATOS PARA NOTIFICACIONES
    const factorySnap = await db.collection("manufacturers").doc(factoryId).get();
    const retailerSnap = await db.collection("retailers").doc(retailerId).get();

    const factoryData = factorySnap.exists ? factorySnap.data() : null;
    const retailerData = retailerSnap.exists ? retailerSnap.data() : null;

    // 🔧 OBTENER EMAILS REALES DE AUTH
    const factoryEmail = await getUserEmail(factoryId) || factoryData?.email || null;
    const retailerEmail = await getUserEmail(retailerId) || retailerData?.email || null;

    console.log(`📧 Emails obtenidos - Fabricante: ${factoryEmail}, Revendedor: ${retailerEmail}`);

    // ══════════════════════════════════════════════════════════
    // 1️⃣ PEDIDO DIRECTO
    // ══════════════════════════════════════════════════════════
    if (orderType === "direct") {
      const shippingMode = m.shippingMode || "pickup";
      
      // 📧 Notificar fabricante
      if (factoryData && factoryEmail) {
        console.log(`📧 Notificando fabricante (pedido directo): ${factoryEmail}`);
        await notifyManufacturerDirectOrder({
          factoryId,
          factoryEmail,
          productName: productData.name,
          qty,
          retailerName: retailerData?.businessName || retailerData?.name || "Revendedor",
          retailerAddress: retailerData?.address?.formattedAddress || "No especificada",
          retailerPhone: retailerData?.phone,
          shippingMode,
          orderId: paymentId.toString(),
        });
      } else {
        console.warn(`⚠️ No se pudo notificar fabricante ${factoryId} - email: ${factoryEmail}`);
      }

      // 📧 Si es RETIRO → Notificar revendedor
      if (shippingMode === "pickup" && retailerData && factoryData && retailerEmail) {
        const pickupDeadline = calculatePickupDeadline(
          new Date(),
          factoryData.schedule
        );

        await paymentRef.update({
          pickupDeadline,
          pickupDeadlineWarning: new Date(pickupDeadline.getTime() - 24 * 60 * 60 * 1000),
        });

        console.log(`📧 Notificando revendedor (retiro directo): ${retailerEmail}`);
        await notifyRetailerPickup({
          retailerId,
          retailerEmail,
          productName: productData.name,
          qty,
          subtotal: productTotal,
          total: totalAmount,
          factoryBusinessName: factoryData.businessName || "Fábrica",
          factoryAddress: factoryData.address?.formattedAddress || "No especificada",
          factorySchedule: factoryData.schedule || DEFAULT_SCHEDULE,
          factoryPhone: factoryData.phone,
          factoryEmail: factoryData.email,
          pickupDeadline,
          orderId: paymentId.toString(),
          isDirect: true,
        });
      } else if (shippingMode === "pickup" && !retailerEmail) {
        console.warn(`⚠️ No se pudo notificar revendedor ${retailerId} - email: ${retailerEmail}`);
      }
    }

    // ══════════════════════════════════════════════════════════
    // 2️⃣ PEDIDO FRACCIONADO
    // ══════════════════════════════════════════════════════════
    if (orderType === "fractional" && lotType) {
      if (lotType !== "fractional_pickup" && lotType !== "fractional_shipping") {
        console.error("❌ lotType inválido:", lotType);
        return NextResponse.json({ received: true });
      }

      await addFraccionadoToLot({
        productId,
        factoryId,
        minimumOrder,
        lotType,
        retailerOrder: { retailerId, qty, paymentId: paymentId.toString() },
      });

      const lotSnap = await db.collection("lots")
        .where("productId", "==", productId)
        .where("factoryId", "==", factoryId)
        .where("type", "==", lotType)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (!lotSnap.empty) {
        const lot = lotSnap.docs[0].data();
        const accumulatedQty = lot.accumulatedQty || 0;

        // 📧 Notificar fabricante del progreso
        if (factoryData && factoryEmail) {
          console.log(`📧 Notificando fabricante (progreso fraccionado): ${factoryEmail}`);
          await notifyManufacturerFractionalProgress({
            factoryId,
            factoryEmail,
            productName: productData.name,
            retailerName: retailerData?.businessName || "Revendedor",
            qty,
            accumulatedQty,
            minimumOrder,
          });
        } else {
          console.warn(`⚠️ No se pudo notificar progreso a fabricante ${factoryId} - email: ${factoryEmail}`);
        }

        // 📧 Si es RETIRO → Notificar revendedor con plazo
        const isPickup = lotType.includes("pickup");
        
        if (isPickup && retailerData && factoryData && retailerEmail) {
          const pickupDeadline = calculatePickupDeadline(
            new Date(),
            factoryData.schedule
          );

          await paymentRef.update({
            pickupDeadline,
            pickupDeadlineWarning: new Date(pickupDeadline.getTime() - 24 * 60 * 60 * 1000),
          });

          // Solo notificar si el lote YA está cerrado
          if (lot.status === "closed") {
            console.log(`📧 Notificando revendedor (lote cerrado): ${retailerEmail}`);
            await notifyRetailerPickup({
              retailerId,
              retailerEmail,
              productName: productData.name,
              qty,
              subtotal: productTotal,
              total: totalAmount,
              factoryBusinessName: factoryData.businessName || "Fábrica",
              factoryAddress: factoryData.address?.formattedAddress || "No especificada",
              factorySchedule: factoryData.schedule || DEFAULT_SCHEDULE,
              factoryPhone: factoryData.phone,
              factoryEmail: factoryData.email,
              pickupDeadline,
              orderId: paymentId.toString(),
              isDirect: false,
            });
          }
        }
      }

      // ══════════════════════════════════════════════════════════
      // 3️⃣ SI EL LOTE SE CIERRA → NOTIFICAR FABRICANTE
      // ══════════════════════════════════════════════════════════
      const closedLotSnap = await db.collection("lots")
        .where("productId", "==", productId)
        .where("factoryId", "==", factoryId)
        .where("type", "==", lotType)
        .where("status", "==", "closed")
        .where("orderCreated", "==", false)
        .limit(1)
        .get();

      if (!closedLotSnap.empty) {
        const closedLot = closedLotSnap.docs[0].data();
        
        await createOrderFromClosedLot({
          ...(closedLot as FraccionatedLot),
          id: closedLotSnap.docs[0].id,
        });

        // 📧 Notificar fabricante que el lote se completó
        if (factoryData && factoryEmail) {
          const retailerPromises = closedLot.orders.map(async (order: any) => {
            const rSnap = await db.collection("retailers").doc(order.retailerId).get();
            const rData = rSnap.data();
            
            return {
              name: rData?.businessName || rData?.name || "Revendedor",
              qty: order.qty,
              address: rData?.address?.formattedAddress || "No especificada",
              phone: rData?.phone,
            };
          });

          const retailers = await Promise.all(retailerPromises);

          console.log(`📧 Notificando fabricante (lote cerrado): ${factoryEmail}`);
          await notifyManufacturerLotClosed({
            factoryId,
            factoryEmail,
            productName: productData.name,
            totalQty: closedLot.accumulatedQty,
            retailers,
            lotType,
            factoryAddress: factoryData.address?.formattedAddress || "No especificada",
            orderId: closedLotSnap.docs[0].id,
          });
        } else {
          console.warn(`⚠️ No se pudo notificar lote cerrado a fabricante ${factoryId} - email: ${factoryEmail}`);
        }

        // 📧 Notificar a TODOS los revendedores del lote cerrado (si es retiro)
        const isPickup = lotType.includes("pickup");
        
        if (isPickup && factoryData) {
          for (const order of closedLot.orders) {
            const rSnap = await db.collection("retailers").doc(order.retailerId).get();
            const rData = rSnap.data();

            if (rData) {
              // 🔧 Obtener email real del revendedor
              const rEmail = await getUserEmail(order.retailerId) || rData.email;

              if (rEmail) {
                const pSnap = await db.collection("payments").doc(order.paymentId).get();
                const pData = pSnap.data();
                
                const pickupDeadline = pData?.pickupDeadline?.toDate() || calculatePickupDeadline(
                  new Date(),
                  factoryData.schedule
                );

                const subtotal = pData?.splitPayment?.productTotal || 0;
                const total = pData?.splitPayment?.total || 0;

                console.log(`📧 Notificando revendedor del lote cerrado: ${rEmail}`);
                await notifyRetailerPickup({
                  retailerId: order.retailerId,
                  retailerEmail: rEmail,
                  productName: productData.name,
                  qty: order.qty,
                  subtotal,
                  total,
                  factoryBusinessName: factoryData.businessName || "Fábrica",
                  factoryAddress: factoryData.address?.formattedAddress || "No especificada",
                  factorySchedule: factoryData.schedule || DEFAULT_SCHEDULE,
                  factoryPhone: factoryData.phone,
                  factoryEmail: factoryData.email,
                  pickupDeadline,
                  orderId: order.paymentId,
                  isDirect: false,
                });
              } else {
                console.warn(`⚠️ No se pudo notificar revendedor ${order.retailerId} - sin email`);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("❌ Error webhook:", err);
    
    console.error("Error details:", {
      message: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json({ received: true });
  }
}

// ✅ PROCESAR PAGO DE DESTACADO
async function processFeaturedPayment({
  paymentId,
  type,
  itemId,
  duration,
  payment,
}: {
  paymentId: string;
  type: "product" | "factory";
  itemId: string;
  duration: 7 | 15 | 30;
  payment: any;
}) {
  try {
    let factoryId = "";
    let metadata: any = {};

    if (type === "product") {
      const productSnap = await db.collection("products").doc(itemId).get();
      if (!productSnap.exists) throw new Error("Producto no encontrado");
      
      const product = productSnap.data()!;
      factoryId = product.factoryId;
      metadata = {
        name: product.name,
        description: product.description || "",
        imageUrl: product.imageUrl || "",
      };

      await productSnap.ref.update({
        featured: true,
        featuredUntil: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });

    } else {
      factoryId = itemId;
      const factorySnap = await db.collection("manufacturers").doc(itemId).get();
      if (!factorySnap.exists) throw new Error("Fábrica no encontrada");
      
      const factory = factorySnap.data()!;
      metadata = {
        name: factory.businessName || factory.name || "Mi fábrica",
        description: factory.description || "",
        imageUrl: factory.imageUrl || "",
      };
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

    await db.collection("featured").add({
      type,
      itemId,
      factoryId,
      duration,
      startDate: FieldValue.serverTimestamp(),
      endDate,
      paymentId,
      amount: payment.transaction_amount || 0,
      active: true,
      expired: false,
      metadata,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`✅ Destacado activado: ${type} ${itemId} por ${duration} días`);

  } catch (error) {
    console.error("❌ Error procesando pago destacado:", error);
    throw error;
  }
}