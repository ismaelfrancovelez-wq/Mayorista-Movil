// app/dashboard/pedidos-fraccionados/page.tsx

import { db } from "../../../lib/firebase-admin";
import { cookies } from "next/headers";
import UserRoleHeader from "../../../components/UserRoleHeader"; // ✅ NUEVO (reemplaza ActiveRoleBadge + SwitchRoleButton)
import Link from "next/link";
import { formatCurrency } from "../../../lib/utils";
import { Suspense } from "react";
import { DashboardSkeleton } from "../../../components/DashboardSkeleton";
import CancelReservationButton from "../../../components/CancelReservationButton";
import HideOrderButton from "../../../components/HideOrderButton";

export const dynamic = "force-dynamic";
export const revalidate = 10;

type ActiveLot = {
  id: string;               // id para la lista (y para el botón hide)
  reservationDocId?: string; // id real del doc reserva (para cancel)
  productId: string;
  productName: string;
  type: string;
  accumulatedQty: number;
  minimumOrder: number;
  userQty: number;
  progress: number;
  userPayments: number;
  isReservation: boolean;
  isPendingLot: boolean;    // true = pending_lot (puede dar de baja)
  lotClosed: boolean;       // true = cerró y esperando pagos
  paymentLink?: string;
  totalFinal?: number;
};

async function DashboardRevendedorContent() {
  const userId = cookies().get("userId")?.value;
  const role = cookies().get("activeRole")?.value;

  if (!userId || role !== "retailer") {
    return <div className="p-6">No autorizado</div>;
  }

  /* ── 1. CONSULTAS PARALELAS ── */
  const [ordersSnap, reservationsSnap, userSnap] = await Promise.all([
    db.collection("payments").where("buyerId", "==", userId).limit(100).get(),
    db.collection("reservations")
      .where("retailerId", "==", userId)
      .where("status", "in", ["pending_lot", "lot_closed", "paid"])
      .limit(100)
      .get(),
    db.collection("users").doc(userId).get(),
  ]);

  const orders = ordersSnap.docs.map((d) => d.data());
  const reservations = reservationsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];

  // IDs ocultos por el usuario
  const hiddenIds: string[] = userSnap.data()?.hiddenOrders || [];

  // ✅ NUEVO: leer email desde cookie; si no existe (sesión previa), usar el de Firestore (ya cargado)
  const userEmail = cookies().get("userEmail")?.value || userSnap.data()?.email || "";

  /* ── 2. ESTADO REAL DE LOTES DESDE FIRESTORE ── */
  const allLotIds = new Set<string>();
  orders.forEach((o) => { if (o.lotId) allLotIds.add(o.lotId); });
  reservations.forEach((r) => { if (r.lotId) allLotIds.add(r.lotId); });

  const lotsRealStatus = new Map<string, {
    status: string;
    accumulatedQty: number;
    minimumOrder: number;
    type: string;
    productId: string;
  }>();

  if (allLotIds.size > 0) {
    const arr = Array.from(allLotIds);
    for (let i = 0; i < arr.length; i += 10) {
      const snap = await db
        .collection("lots")
        .where("__name__", "in", arr.slice(i, i + 10))
        .get();
      snap.docs.forEach((d) => {
        lotsRealStatus.set(d.id, {
          status: d.data().status,
          accumulatedQty: d.data().accumulatedQty || 0,
          minimumOrder: d.data().minimumOrder || d.data().MF || 0,
          type: d.data().type,
          productId: d.data().productId,
        });
      });
    }
  }

  /* ── 3. KPIs ── */
  const directOrders = orders.filter((o) => o.orderType === "directa");

  const fullyPaidLotIds = new Set<string>();
  orders.forEach((o) => {
    if (o.orderType === "fraccionado" && o.lotId) {
      if (lotsRealStatus.get(o.lotId)?.status === "fully_paid") fullyPaidLotIds.add(o.lotId);
    }
  });
  reservations.forEach((r) => {
    if (r.status === "paid" && r.lotId) {
      if (lotsRealStatus.get(r.lotId)?.status === "fully_paid") fullyPaidLotIds.add(r.lotId);
    }
  });

  const pedidosTotalesCount = directOrders.length + fullyPaidLotIds.size;

  const activeFractionalLots = new Set<string>();
  orders.forEach((o) => {
    if (o.orderType === "fraccionado" && o.lotId) {
      const realStatus = lotsRealStatus.get(o.lotId)?.status;
      if (realStatus && realStatus !== "fully_paid") activeFractionalLots.add(o.lotId);
    }
  });

  const activeReservationLots = new Set<string>();
  reservations.forEach((r) => {
    if ((r.status === "pending_lot" || r.status === "lot_closed") && r.lotId) {
      activeReservationLots.add(r.lotId);
    }
  });

  const pedidosEnProcesoCount = activeFractionalLots.size + activeReservationLots.size;

  const totalInvertido =
    orders
      .filter((o) => {
        if (o.orderType === "directa") return true;
        if (o.orderType === "fraccionado" && o.lotId) {
          return lotsRealStatus.get(o.lotId)?.status === "fully_paid";
        }
        return false;
      })
      .reduce((acc, o) => acc + (o.total || 0), 0) +
    reservations
      .filter((r) => r.status === "paid")
      .reduce((acc, r) => acc + (r.totalFinal || 0), 0);

  /* ── 4. LOTES EN CURSO ── */
  const lotMapFromPayments = new Map<string, {
    lotId: string;
    productId: string;
    productName: string;
    totalQty: number;
    payments: number;
  }>();

  orders
    .filter((o) => {
      if (o.orderType !== "fraccionado" || !o.lotId) return false;
      const realStatus = lotsRealStatus.get(o.lotId)?.status;
      return realStatus && realStatus !== "fully_paid";
    })
    .forEach((p) => {
      const lotId = p.lotId;
      if (lotMapFromPayments.has(lotId)) {
        const e = lotMapFromPayments.get(lotId)!;
        e.totalQty += p.qty || 0;
        e.payments += 1;
      } else {
        lotMapFromPayments.set(lotId, {
          lotId,
          productId: p.productId,
          productName: p.productName || "Producto",
          totalQty: p.qty || 0,
          payments: 1,
        });
      }
    });

  const lotMapFromReservations = new Map<string, {
    lotId: string;
    reservationDocId: string;
    productId: string;
    productName: string;
    totalQty: number;
    status: string;
    paymentLink?: string;
    totalFinal?: number;
  }>();

  reservations
    .filter((r) => r.status === "pending_lot" || r.status === "lot_closed")
    .forEach((r) => {
      if (!r.lotId || lotMapFromPayments.has(r.lotId)) return;
      if (lotMapFromReservations.has(r.lotId)) {
        lotMapFromReservations.get(r.lotId)!.totalQty += r.qty || 0;
      } else {
        lotMapFromReservations.set(r.lotId, {
          lotId: r.lotId,
          reservationDocId: r.id,
          productId: r.productId,
          productName: r.productName || "Producto",
          totalQty: r.qty || 0,
          status: r.status,
          paymentLink: r.paymentLink || null,
          totalFinal: r.totalFinal || null,
        });
      }
    });

  /* ── 5. ARMAR LISTA DE LOTES ACTIVOS ── */
  const activeLots: ActiveLot[] = [];

  for (const [lotId, ui] of lotMapFromPayments.entries()) {
    const listId = lotId;
    if (hiddenIds.includes(listId)) continue;

    const lotReal = lotsRealStatus.get(lotId);
    if (!lotReal) continue;

    activeLots.push({
      id: listId,
      productId: lotReal.productId || ui.productId,
      productName: ui.productName,
      type: lotReal.type,
      accumulatedQty: lotReal.accumulatedQty,
      minimumOrder: lotReal.minimumOrder,
      userQty: ui.totalQty,
      userPayments: ui.payments,
      progress: lotReal.minimumOrder > 0
        ? Math.min((lotReal.accumulatedQty / lotReal.minimumOrder) * 100, 100)
        : 0,
      isReservation: false,
      isPendingLot: false,
      lotClosed: lotReal.status === "closed",
    });
  }

  for (const [lotId, ui] of lotMapFromReservations.entries()) {
    const listId = `reservation-${lotId}`;
    if (hiddenIds.includes(listId)) continue;

    const lotReal = lotsRealStatus.get(lotId);
    if (!lotReal) continue;

    activeLots.push({
      id: listId,
      reservationDocId: ui.reservationDocId,
      productId: lotReal.productId || ui.productId,
      productName: ui.productName,
      type: lotReal.type,
      accumulatedQty: lotReal.accumulatedQty,
      minimumOrder: lotReal.minimumOrder,
      userQty: ui.totalQty,
      userPayments: 1,
      progress: lotReal.minimumOrder > 0
        ? Math.min((lotReal.accumulatedQty / lotReal.minimumOrder) * 100, 100)
        : 0,
      isReservation: true,
      isPendingLot: ui.status === "pending_lot",
      lotClosed: ui.status === "lot_closed" || lotReal.status === "closed",
      paymentLink: ui.paymentLink,
      totalFinal: ui.totalFinal,
    });
  }

  // Completar nombres faltantes
  const lotsWithoutName = activeLots.filter((l) => !l.productName || l.productName === "Producto");
  if (lotsWithoutName.length > 0) {
    const productIds = [...new Set(lotsWithoutName.map((l) => l.productId))];
    for (let i = 0; i < productIds.length; i += 10) {
      const snap = await db
        .collection("products")
        .where("__name__", "in", productIds.slice(i, i + 10))
        .get();
      const pm = new Map<string, string>();
      snap.docs.forEach((d) => pm.set(d.id, d.data().name));
      activeLots.forEach((l) => {
        if ((!l.productName || l.productName === "Producto") && pm.has(l.productId))
          l.productName = pm.get(l.productId)!;
      });
    }
  }

  /* ── UI ── */
  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        fontFamily: "'DM Sans', 'Sora', sans-serif",
      }}
    >
      {/* Ambient glow effects */}
      <div
        style={{
          position: "fixed",
          top: "-10%",
          right: "-5%",
          width: "500px",
          height: "500px",
          background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "10%",
          left: "-5%",
          width: "400px",
          height: "400px",
          background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div className="relative p-6 md:p-10 max-w-6xl mx-auto" style={{ zIndex: 1 }}>

        {/* ── HEADER ── */}
        <div className="flex justify-between items-start mb-12">
          <div>
            {/* Eyebrow label */}
            <div className="flex items-center gap-2 mb-3">
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 8px #10b981",
                  animation: "pulse 2s infinite",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#10b981",
                }}
              >
                Panel activo
              </span>
            </div>
            <h1
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
                fontWeight: 800,
                color: "#f8fafc",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              Dashboard del
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #818cf8, #a78bfa)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                revendedor
              </span>
            </h1>
            <p style={{ color: "#94a3b8", marginTop: "8px", fontSize: "0.95rem" }}>
              Gestioná tus compras y pedidos
            </p>
          </div>

          {/* UserRoleHeader — sin cambios funcionales */}
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "14px",
              padding: "4px",
              backdropFilter: "blur(12px)",
            }}
          >
            <UserRoleHeader userEmail={userEmail} activeRole="retailer" />
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {/* KPI 1 */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "20px",
              padding: "28px",
              backdropFilter: "blur(20px)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: "linear-gradient(90deg, #818cf8, #a78bfa)",
                borderRadius: "20px 20px 0 0",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(129,140,248,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                }}
              >
                📦
              </div>
              <span style={{ color: "#94a3b8", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Pedidos totales
              </span>
            </div>
            <p
              style={{
                fontSize: "3rem",
                fontWeight: 800,
                color: "#f8fafc",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              {pedidosTotalesCount}
            </p>
          </div>

          {/* KPI 2 */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "20px",
              padding: "28px",
              backdropFilter: "blur(20px)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
                borderRadius: "20px 20px 0 0",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(245,158,11,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                }}
              >
                ⚡
              </div>
              <span style={{ color: "#94a3b8", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                En proceso
              </span>
            </div>
            <p
              style={{
                fontSize: "3rem",
                fontWeight: 800,
                color: "#f8fafc",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              {pedidosEnProcesoCount}
            </p>
          </div>

          {/* KPI 3 */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "20px",
              padding: "28px",
              backdropFilter: "blur(20px)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: "linear-gradient(90deg, #10b981, #34d399)",
                borderRadius: "20px 20px 0 0",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(16,185,129,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                }}
              >
                💰
              </div>
              <span style={{ color: "#94a3b8", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Total invertido
              </span>
            </div>
            <p
              style={{
                fontSize: "2.2rem",
                fontWeight: 800,
                color: "#f8fafc",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              {formatCurrency(totalInvertido)}
            </p>
          </div>
        </div>

        {/* ── LOTES EN CURSO ── */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "24px",
            padding: "32px",
            backdropFilter: "blur(20px)",
            marginBottom: "32px",
          }}
        >
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
            <div
              style={{
                width: "4px",
                height: "24px",
                background: "linear-gradient(180deg, #818cf8, #a78bfa)",
                borderRadius: "4px",
              }}
            />
            <h2
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#f1f5f9",
                letterSpacing: "-0.01em",
              }}
            >
              Pedidos fraccionados en curso
            </h2>
            {activeLots.length > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "rgba(129,140,248,0.15)",
                  color: "#818cf8",
                  border: "1px solid rgba(129,140,248,0.3)",
                  borderRadius: "999px",
                  padding: "2px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                }}
              >
                {activeLots.length} activos
              </span>
            )}
          </div>

          {activeLots.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                color: "#64748b",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📭</div>
              <p style={{ fontSize: "0.95rem" }}>No tenés pedidos fraccionados en proceso actualmente.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {activeLots.map((lot) => {
                const progressPercent = Math.round(lot.progress);
                const isNearComplete = progressPercent >= 80;

                return (
                  <div
                    key={lot.id}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: lot.lotClosed
                        ? "1px solid rgba(99,102,241,0.25)"
                        : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "16px",
                      padding: "20px 22px",
                      transition: "border-color 0.2s, background 0.2s",
                    }}
                  >
                    {/* Row 1: nombre + badges + qty + ocultar */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#f1f5f9",
                            fontSize: "1rem",
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {lot.productName}
                        </span>

                        {/* Badge: Reserva */}
                        {lot.isReservation && lot.isPendingLot && (
                          <span
                            style={{
                              padding: "2px 10px",
                              background: "rgba(251,146,60,0.15)",
                              color: "#fb923c",
                              border: "1px solid rgba(251,146,60,0.3)",
                              borderRadius: "999px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                            }}
                          >
                            Reserva
                          </span>
                        )}
                        {/* Badge: Esperando tu pago */}
                        {lot.isReservation && lot.lotClosed && (
                          <span
                            style={{
                              padding: "2px 10px",
                              background: "rgba(99,102,241,0.15)",
                              color: "#818cf8",
                              border: "1px solid rgba(99,102,241,0.3)",
                              borderRadius: "999px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                            }}
                          >
                            Esperando tu pago
                          </span>
                        )}
                        {/* Badge: A la espera de pagos */}
                        {!lot.isReservation && lot.lotClosed && (
                          <span
                            style={{
                              padding: "2px 10px",
                              background: "rgba(245,158,11,0.12)",
                              color: "#fbbf24",
                              border: "1px solid rgba(245,158,11,0.25)",
                              borderRadius: "999px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                            }}
                          >
                            A la espera de pagos
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span
                          style={{
                            fontSize: "0.82rem",
                            color: "#64748b",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "8px",
                            padding: "3px 10px",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {lot.accumulatedQty} / {lot.minimumOrder} uds.
                        </span>
                        {!lot.isPendingLot && !lot.lotClosed && (
                          <HideOrderButton itemId={lot.id} label="Ocultar" />
                        )}
                      </div>
                    </div>

                    {/* Subtext: tu pedido */}
                    <p
                      style={{
                        fontSize: "0.8rem",
                        color: "#64748b",
                        marginBottom: "14px",
                      }}
                    >
                      Tu pedido:{" "}
                      <span style={{ color: "#94a3b8", fontWeight: 600 }}>
                        {lot.userQty} unidades
                      </span>
                      {!lot.isReservation && lot.userPayments > 1 &&
                        ` en ${lot.userPayments} compras`}
                    </p>

                    {/* Barra de progreso */}
                    {!lot.lotClosed && (
                      <>
                        <div
                          style={{
                            width: "100%",
                            background: "rgba(255,255,255,0.07)",
                            borderRadius: "999px",
                            height: "8px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${progressPercent}%`,
                              borderRadius: "999px",
                              background: isNearComplete
                                ? "linear-gradient(90deg, #10b981, #34d399)"
                                : "linear-gradient(90deg, #6366f1, #818cf8)",
                              boxShadow: isNearComplete
                                ? "0 0 12px rgba(16,185,129,0.5)"
                                : "0 0 12px rgba(99,102,241,0.4)",
                              transition: "width 0.6s ease",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                          {isNearComplete ? (
                            <p style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 600 }}>
                              ✦ ¡Cerca de completarse!
                            </p>
                          ) : (
                            <span style={{ fontSize: "0.72rem", color: "#475569" }}>
                              {progressPercent}% completado
                            </span>
                          )}
                          {lot.isReservation && lot.isPendingLot && (
                            <p style={{ fontSize: "0.75rem", color: "#fb923c", fontWeight: 500 }}>
                              🔖 Te avisamos cuando el lote esté completo
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {/* Lote cerró + tiene link de pago (reserva) */}
                    {lot.lotClosed && lot.isReservation && lot.paymentLink && (
                      <div
                        style={{
                          marginTop: "14px",
                          padding: "16px",
                          background: "rgba(99,102,241,0.08)",
                          border: "1px solid rgba(99,102,241,0.2)",
                          borderRadius: "12px",
                        }}
                      >
                        <p style={{ fontSize: "0.82rem", color: "#a5b4fc", marginBottom: "12px", fontWeight: 500 }}>
                          ✅ El lote alcanzó el mínimo. Completá tu pago para confirmar la compra.
                        </p>
                        <a
                          href={lot.paymentLink}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            background: "linear-gradient(135deg, #6366f1, #818cf8)",
                            color: "#ffffff",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            padding: "10px 22px",
                            borderRadius: "10px",
                            textDecoration: "none",
                            boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
                            transition: "opacity 0.2s, transform 0.2s",
                          }}
                        >
                          💳 Pagar ahora — {formatCurrency(lot.totalFinal ?? 0)}
                        </a>
                      </div>
                    )}

                    {/* Lote cerró + pago normal (esperando otros) */}
                    {lot.lotClosed && !lot.isReservation && (
                      <div
                        style={{
                          marginTop: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 14px",
                          background: "rgba(245,158,11,0.08)",
                          border: "1px solid rgba(245,158,11,0.15)",
                          borderRadius: "10px",
                        }}
                      >
                        <span style={{ fontSize: "0.82rem", color: "#fbbf24", fontWeight: 500 }}>
                          ⏳ Tu pago está confirmado — esperando que los demás compradores del lote paguen
                        </span>
                      </div>
                    )}

                    {/* Botón dar de baja */}
                    {lot.isReservation && lot.isPendingLot && lot.reservationDocId && (
                      <div style={{ marginTop: "14px" }}>
                        <CancelReservationButton
                          reservationId={lot.reservationDocId}
                          productName={lot.productName}
                        />
                      </div>
                    )}

                    {/* Bloqueado si quiere cancelar en lot_closed */}
                    {lot.isReservation && lot.lotClosed && (
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "#475569",
                          marginTop: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span>🔒</span>
                        <span>El lote cerró — no es posible darse de baja en esta etapa</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── EXPLORAR ── */}
        <div className="grid md:grid-cols-1 gap-6 mb-12">
          <Link
            href="/explorar"
            style={{
              display: "block",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "24px",
              padding: "32px",
              backdropFilter: "blur(20px)",
              textDecoration: "none",
              transition: "background 0.2s, border-color 0.2s, transform 0.2s",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative corner gradient */}
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: "200px",
                height: "200px",
                background: "radial-gradient(circle at top right, rgba(129,140,248,0.1), transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div
                  style={{
                    fontSize: "2rem",
                    marginBottom: "12px",
                  }}
                >
                  🏪
                </div>
                <h2
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: 700,
                    color: "#f1f5f9",
                    letterSpacing: "-0.02em",
                    marginBottom: "6px",
                  }}
                >
                  Explorar productos
                </h2>
                <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                  Comprá directo o fraccionado
                </p>
              </div>
              <span
                style={{
                  fontSize: "1.5rem",
                  color: "#818cf8",
                  fontWeight: 300,
                  lineHeight: 1,
                }}
              >
                →
              </span>
            </div>
          </Link>
        </div>

      </div>

      {/* Pulse animation for the green dot */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

export default function DashboardRevendedor() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardRevendedorContent />
    </Suspense>
  );
}