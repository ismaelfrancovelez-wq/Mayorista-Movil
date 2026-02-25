// app/api/lots/closing-soon/route.ts
//
// GET — Devuelve lotes que están al 80% o más de su mínimo,
// junto con los datos del producto y fabricante asociados.
// Usada por /explorar (sección) y /explorar/cerrando (página dedicada).

import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type ClosingSoonLot = {
  lotId: string;
  productId: string;
  productName: string;
  productPrice: number;
  minimumOrder: number;
  accumulatedQty: number;
  progress: number; // 0 a 1
  percentage: number; // 0 a 100
  lotType: string;
  imageUrls?: string[];
  manufacturerName?: string;
  manufacturerImageUrl?: string;
  manufacturerVerified?: boolean;
};

export async function GET() {
  try {
    // Traer lotes acumulando — sin orderBy para evitar índice compuesto
    const snap = await db
      .collection("lots")
      .where("status", "==", "accumulating")
      .get();

    if (snap.empty) {
      return NextResponse.json({ lots: [] });
    }

    // Filtrar los que están al 80%+ en memoria
    const closingDocs = snap.docs.filter((doc) => {
      const d = doc.data();
      const accumulated = d.accumulatedQty || 0;
      const minimum = d.minimumOrder || 0;
      if (minimum <= 0) return false;
      return accumulated / minimum >= 0.8;
    });

    if (closingDocs.length === 0) {
      return NextResponse.json({ lots: [] });
    }

    // Recopilar productIds únicos
    const productIds = [
      ...new Set(closingDocs.map((d) => d.data().productId).filter(Boolean)),
    ] as string[];

    // Fetch productos en batch (máx 10 por query 'in')
    const productMap: Record<string, {
      name: string;
      price: number;
      minimumOrder: number;
      imageUrls?: string[];
      factoryId?: string;
    }> = {};

    const productChunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += 10) {
      productChunks.push(productIds.slice(i, i + 10));
    }
    for (const chunk of productChunks) {
      const pSnap = await db
        .collection("products")
        .where("__name__", "in", chunk)
        .get();
      pSnap.docs.forEach((doc) => {
        const d = doc.data();
        productMap[doc.id] = {
          name: d.name || "Producto",
          price: d.price || 0,
          minimumOrder: d.minimumOrder || 0,
          imageUrls: Array.isArray(d.imageUrls) ? d.imageUrls : undefined,
          factoryId: d.factoryId || undefined,
        };
      });
    }

    // Recopilar factoryIds únicos
    const factoryIds = [
      ...new Set(
        Object.values(productMap)
          .map((p) => p.factoryId)
          .filter(Boolean)
      ),
    ] as string[];

    const manufacturerMap: Record<string, {
      businessName?: string;
      profileImageUrl?: string;
      verified?: boolean;
    }> = {};

    const factoryChunks: string[][] = [];
    for (let i = 0; i < factoryIds.length; i += 10) {
      factoryChunks.push(factoryIds.slice(i, i + 10));
    }
    for (const chunk of factoryChunks) {
      const mSnap = await db
        .collection("manufacturers")
        .where("__name__", "in", chunk)
        .get();
      mSnap.docs.forEach((doc) => {
        const d = doc.data();
        manufacturerMap[doc.id] = {
          businessName: d.businessName || "",
          profileImageUrl: d.profileImageUrl || "",
          verified: d.verification?.status === "verified",
        };
      });
    }

    // Construir respuesta
    const lots: ClosingSoonLot[] = closingDocs
      .map((doc) => {
        const d = doc.data();
        const productId = d.productId;
        const product = productMap[productId];
        if (!product) return null;

        const accumulated = d.accumulatedQty || 0;
        const minimum = product.minimumOrder || d.minimumOrder || 0;
        const progress = minimum > 0 ? accumulated / minimum : 0;

        const manufacturer = product.factoryId
          ? manufacturerMap[product.factoryId]
          : null;

        return {
          lotId: doc.id,
          productId,
          productName: product.name,
          productPrice: product.price,
          minimumOrder: minimum,
          accumulatedQty: accumulated,
          progress: Math.min(progress, 1),
          percentage: Math.min(Math.round(progress * 100), 100),
          lotType: d.type || "fraccionado",
          imageUrls: product.imageUrls,
          manufacturerName: manufacturer?.businessName || undefined,
          manufacturerImageUrl: manufacturer?.profileImageUrl || undefined,
          manufacturerVerified: manufacturer?.verified || false,
        } as ClosingSoonLot;
      })
      .filter(Boolean) as ClosingSoonLot[];

    // Ordenar por porcentaje descendente (los más cercanos al cierre primero)
    lots.sort((a, b) => b.percentage - a.percentage);

    return NextResponse.json({ lots });
  } catch (error) {
    console.error("❌ Error en closing-soon:", error);
    return NextResponse.json(
      { error: "Error obteniendo lotes por cerrar" },
      { status: 500 }
    );
  }
}