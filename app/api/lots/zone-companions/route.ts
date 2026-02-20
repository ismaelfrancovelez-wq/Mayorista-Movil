// app/api/lots/zone-companions/route.ts — VERSIÓN FINAL
//
// GET /api/lots/zone-companions?productId=XXX
//
// Devuelve para el simulador de ahorro de envío (SOLO COMPRAS FRACCIONADAS):
//   - shippingCostTotal: costo del envío del comprador MÁS LEJANO de base
//     dentro del lote. Si hay múltiples compradores en el mismo código postal,
//     todos dividen el costo del más lejano (cubre diferencias de distancia
//     dentro de la misma zona). Si el usuario actual no está en el lote,
//     se usa su propia distancia como referencia.
//   - groups: compradores del lote agrupados por código postal
//   - totalBuyers: total de compradores en el lote
//
// ─── FÓRMULA DE ENVÍO (igual que lib/shipping.ts) ─────────────────
//   costo = (kmBase→Fábrica + kmFábrica→Retailer) × 2 × $85 + $3500
//   BASE = "Poeta Romildo Risso 3244, William Morris, Hurlingham"
// ──────────────────────────────────────────────────────────────────
//
// ─── COMPATIBILIDAD CON BASE DE DATOS ─────────────────────────────
//   Lotes legacy:  type="fraccionado_envio" / status="open"
//   Lotes nuevos:  type="fractional_shipping" / status="accumulating"
//   → Cubrimos los 4 casos con 2 queries + filtro JS
//
//   Índices Firestore disponibles (sin agregar nuevos):
//     - lots: productId + status (ASCENDING)  ← usamos este
//
//   Nombre de usuario: colección "users" → campo "name" o "email"
//   Dirección: colección "retailers" → address.formattedAddress
//   Código postal: extraído con regex del formattedAddress
// ──────────────────────────────────────────────────────────────────
//
// ─── SOLO FRACCIONADO ──────────────────────────────────────────────
//   Solo buscamos lotes de tipo envío fraccionado.
//   Las compras directas (direct_shipping, directa_envio) NO se tocan.
// ──────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { calculateFraccionadoShipping } from "../../../../lib/shipping";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Tipos de lote FRACCIONADO de envío (legacy + nuevo)
// NO incluye direct_shipping ni directa_envio (compras directas)
const FRACCIONADO_SHIPPING_TYPES = new Set([
  "fractional_shipping",  // nuevo
  "fraccionado_envio",    // legacy
]);

/* ====================================================
   EXTRAER CÓDIGO POSTAL DE DIRECCIÓN FORMATEADA
   Soporta formatos argentinos:
     - Con letra: B1686, C1425, A4400
     - Solo números: 1686, 7000, 5000
==================================================== */
function extractPostalCode(formattedAddress: string): string | null {
  if (!formattedAddress) return null;

  // Prioridad: código con letra (más específico)
  const alphaMatch = formattedAddress.match(/\b([A-Z]\d{4}[A-Z]{0,3})\b/);
  if (alphaMatch) return alphaMatch[1];

  // Fallback: 4 dígitos
  const numMatch = formattedAddress.match(/\b(\d{4})\b/);
  if (numMatch) return numMatch[1];

  return null;
}

/* ====================================================
   CALCULAR COSTO DE ENVÍO FRACCIONADO
   Wrapper que retorna null si falla (no bloquea la respuesta)
==================================================== */
async function calcShippingCost(
  factoryAddress: string,
  retailerAddress: string
): Promise<number | null> {
  try {
    const result = await calculateFraccionadoShipping({
      factoryAddress,
      retailerAddress,
    });
    return result.totalCost;
  } catch (err) {
    console.warn("⚠️ Error calculando envío para simulador:", err);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { error: "productId requerido" },
        { status: 400 }
      );
    }

    /* ===================================================
       1. OBTENER RETAILER ACTUAL (desde cookie)
          Necesitamos su dirección para:
          a) Calcular su costo de envío (si no está en el lote)
          b) Mostrarlo como referencia en el simulador
    ==================================================== */
    const currentRetailerId = cookies().get("userId")?.value;
    let currentRetailerAddress: string | null = null;

    if (currentRetailerId) {
      const retailerSnap = await db
        .collection("retailers")
        .doc(currentRetailerId)
        .get();

      if (retailerSnap.exists) {
        currentRetailerAddress =
          retailerSnap.data()?.address?.formattedAddress ?? null;
      }

      // Fallback a colección users
      if (!currentRetailerAddress) {
        const userSnap = await db
          .collection("users")
          .doc(currentRetailerId)
          .get();
        if (userSnap.exists) {
          currentRetailerAddress =
            userSnap.data()?.address?.formattedAddress ?? null;
        }
      }
    }

    /* ===================================================
       2. OBTENER DATOS DEL PRODUCTO Y FÁBRICA
    ==================================================== */
    const productSnap = await db
      .collection("products")
      .doc(productId)
      .get();

    if (!productSnap.exists) {
      return NextResponse.json({
        shippingCostTotal: null,
        groups: [],
        totalBuyers: 0,
      });
    }

    const product = productSnap.data()!;
    const factoryId = product.factoryId as string | undefined;

    if (!factoryId) {
      return NextResponse.json({
        shippingCostTotal: null,
        groups: [],
        totalBuyers: 0,
      });
    }

    const factorySnap = await db
      .collection("manufacturers")
      .doc(factoryId)
      .get();

    const factoryAddress: string | null =
      factorySnap.data()?.address?.formattedAddress ?? null;

    /* ===================================================
       3. BUSCAR LOTE ACTIVO DE ENVÍO FRACCIONADO
          (NO de compras directas)
          
          Usamos el índice existente: productId + status
          y filtramos por tipo en JavaScript para no
          requerir nuevos índices compuestos en Firestore.
    ==================================================== */

    // Query 1: status nuevo "accumulating"
    const accumulatingSnap = await db
      .collection("lots")
      .where("productId", "==", productId)
      .where("status", "==", "accumulating")
      .get();

    // Query 2: status legacy "open"
    const openSnap = await db
      .collection("lots")
      .where("productId", "==", productId)
      .where("status", "==", "open")
      .get();

    // Combinar y filtrar: solo lotes FRACCIONADOS de ENVÍO
    const allActiveDocs = [...accumulatingSnap.docs, ...openSnap.docs];
    const shippingLotDoc = allActiveDocs.find((doc) =>
      FRACCIONADO_SHIPPING_TYPES.has(doc.data().type)
    );

    if (!shippingLotDoc) {
      // No hay lote activo → mostrar simulador con costo del usuario actual
      let shippingCostTotal: number | null = null;
      if (factoryAddress && currentRetailerAddress) {
        shippingCostTotal = await calcShippingCost(
          factoryAddress,
          currentRetailerAddress
        );
      }

      return NextResponse.json({
        shippingCostTotal,
        groups: [],
        totalBuyers: 0,
      });
    }

    const lot = shippingLotDoc.data();

    /* ===================================================
       4. ORDERS DEL LOTE
    ==================================================== */
    const orders: Array<{
      retailerId: string;
      qty: number;
      paymentId: string;
    }> = lot.orders || [];

    /* ===================================================
       5. PARA CADA RETAILER DEL LOTE: obtener
          - dirección (para calcular distancia)
          - nombre (para mostrar en la UI)
          - código postal (para agrupar)
    ==================================================== */
    const retailerIds = [
      ...new Set(orders.map((o) => o.retailerId)),
    ];

    // También incluir al usuario actual si tiene dirección
    // (para que vea su propio grupo aunque no haya comprado aún)
    if (
      currentRetailerId &&
      currentRetailerAddress &&
      !retailerIds.includes(currentRetailerId)
    ) {
      retailerIds.push(currentRetailerId);
    }

    // Datos de cada retailer: { postalCode, displayName, address }
    const retailerDataMap: Record<
      string,
      {
        postalCode: string | null;
        displayName: string;
        address: string | null;
      }
    > = {};

    await Promise.all(
      retailerIds.map(async (rId) => {
        try {
          let address: string | null = null;
          let postalCode: string | null = null;
          let displayName = "Comprador";

          // Dirección desde "retailers"
          const retailerSnap = await db
            .collection("retailers")
            .doc(rId)
            .get();

          if (retailerSnap.exists) {
            const addr =
              retailerSnap.data()?.address?.formattedAddress ?? null;
            address = addr;
            if (addr) postalCode = extractPostalCode(addr);
          }

          // Nombre desde "users" (campo "name" o parte del email)
          const userSnap = await db.collection("users").doc(rId).get();
          if (userSnap.exists) {
            const userData = userSnap.data()!;
            displayName =
              userData.name ||
              (userData.email ? userData.email.split("@")[0] : "Comprador");

            // Fallback dirección/CP desde users
            if (!address) {
              address =
                userData.address?.formattedAddress ?? null;
            }
            if (!postalCode && address) {
              postalCode = extractPostalCode(address);
            }
          }

          // Para el usuario actual, usar su dirección ya conocida
          if (rId === currentRetailerId && !address) {
            address = currentRetailerAddress;
            if (address) postalCode = extractPostalCode(address);
          }

          retailerDataMap[rId] = { postalCode, displayName, address };
        } catch (err) {
          console.error(`Error obteniendo datos de retailer ${rId}:`, err);
          retailerDataMap[rId] = {
            postalCode: null,
            displayName: "Comprador",
            address: null,
          };
        }
      })
    );

    /* ===================================================
       6. CALCULAR COSTO DE ENVÍO POR CÓDIGO POSTAL
          
          LÓGICA "MÁS LEJANO DE BASE":
          Para cada grupo de código postal, calculamos el
          costo de envío de CADA persona en ese grupo.
          El que resulte más alto (el más lejano de la base
          Poeta Romildo Risso 3244) es el precio que se
          divide entre todos los del mismo código postal.
          
          Esto garantiza que aunque Juan esté a 10km y
          Marta a 11.5km de la base, todos paguen el
          costo de Marta (el más alto) dividido entre 2.
          
          SOLO para LOTES FRACCIONADOS DE ENVÍO.
          Las compras directas no usan esta lógica.
    ==================================================== */

    // Agrupar retailers por código postal (solo los del lote, no el usuario actual)
    const postalGroups: Record<
      string,
      {
        buyerCount: number;
        buyerNames: string[];
        addresses: string[]; // todas las direcciones del grupo
        retailerIds: string[]; // para referencia
      }
    > = {};

    // Solo iteramos los orders del lote (no incluimos al usuario actual aquí)
    for (const order of orders) {
      const info = retailerDataMap[order.retailerId];
      const cp = info?.postalCode ?? null;
      const name = info?.displayName ?? "Comprador";
      const addr = info?.address ?? null;

      if (!cp) continue; // sin CP no podemos agrupar

      if (!postalGroups[cp]) {
        postalGroups[cp] = {
          buyerCount: 0,
          buyerNames: [],
          addresses: [],
          retailerIds: [],
        };
      }

      postalGroups[cp].buyerCount += 1;
      postalGroups[cp].retailerIds.push(order.retailerId);

      if (!postalGroups[cp].buyerNames.includes(name)) {
        postalGroups[cp].buyerNames.push(name);
      }

      if (addr && !postalGroups[cp].addresses.includes(addr)) {
        postalGroups[cp].addresses.push(addr);
      }
    }

    /* ===================================================
       7. CALCULAR "COSTO MÁXIMO" POR GRUPO POSTAL
          
          Para cada grupo, calculamos el envío de cada
          dirección del grupo y tomamos el máximo.
          Ese es el costo que se divide entre todos.
          
          Si la fábrica no tiene dirección → usamos null.
    ==================================================== */
    const groupsResult: Array<{
      postalCode: string;
      buyerCount: number;
      buyerNames: string[];
      maxShippingCost: number | null; // costo del más lejano del grupo
    }> = [];

    for (const [cp, groupData] of Object.entries(postalGroups)) {
      let maxCost: number | null = null;

      if (factoryAddress && groupData.addresses.length > 0) {
        // Calcular costo para cada dirección del grupo en paralelo
        const costs = await Promise.all(
          groupData.addresses.map((addr) =>
            calcShippingCost(factoryAddress, addr)
          )
        );

        // Tomar el máximo (el más lejano de base)
        const validCosts = costs.filter(
          (c): c is number => c !== null
        );
        if (validCosts.length > 0) {
          maxCost = Math.max(...validCosts);
        }
      }

      groupsResult.push({
        postalCode: cp,
        buyerCount: groupData.buyerCount,
        buyerNames: groupData.buyerNames,
        maxShippingCost: maxCost,
      });
    }

    /* ===================================================
       8. CALCULAR shippingCostTotal PARA EL SIMULADOR
          
          El simulador muestra el costo de envío que
          ve el usuario actual. Para esto usamos:
          
          a) Si el usuario actual está en el lote: el
             costo máximo de su grupo postal (ya calculado)
          
          b) Si el usuario actual NO está en el lote
             todavía: calculamos su propio costo de envío
             (así el simulador le muestra qué ahorraría
             si se suma con vecinos de su zona)
    ==================================================== */
    let shippingCostTotal: number | null = null;

    if (currentRetailerId && currentRetailerAddress && factoryAddress) {
      // ¿Está el usuario actual en el lote?
      const currentUserInLot = orders.some(
        (o) => o.retailerId === currentRetailerId
      );

      if (currentUserInLot) {
        // Usar el costo máximo de su grupo
        const currentUserCP = retailerDataMap[currentRetailerId]?.postalCode;
        if (currentUserCP) {
          const myGroup = groupsResult.find(
            (g) => g.postalCode === currentUserCP
          );
          shippingCostTotal = myGroup?.maxShippingCost ?? null;
        }
      }

      // Si no está en el lote o no encontramos el costo, calcular el suyo
      if (!shippingCostTotal) {
        shippingCostTotal = await calcShippingCost(
          factoryAddress,
          currentRetailerAddress
        );
      }
    }

    /* ===================================================
       9. RESPUESTA FINAL
    ==================================================== */
    return NextResponse.json({
      shippingCostTotal,
      groups: groupsResult.map((g) => ({
        postalCode: g.postalCode,
        buyerCount: g.buyerCount,
        buyerNames: g.buyerNames,
        // El costo que se divide entre los compradores del grupo
        // es el del más lejano de la base logística
        groupShippingCost: g.maxShippingCost,
      })),
      totalBuyers: orders.length,
      lotId: shippingLotDoc.id,
    });
  } catch (error: any) {
    console.error("❌ Error en zone-companions:", error);
    return NextResponse.json(
      { error: "Error obteniendo datos del lote" },
      { status: 500 }
    );
  }
}