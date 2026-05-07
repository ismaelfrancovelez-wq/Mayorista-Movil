import { db } from "../../../lib/firebase-admin";
import { cookies } from "next/headers";
import Link from "next/link";
import PagarReservaClient from "./PagarReservaClient";
import {
  PAYMENT_METHODS_META,
  getPriceBreakdown,
  PaymentMethod,
} from "../../../lib/pricing/commission";

export const dynamic = "force-dynamic";

type Reservation = {
  id: string;
  retailerId: string;
  retailerName: string;
  retailerEmail: string;
  productId: string;
  productName: string;
  factoryId: string;
  factoryName: string;
  qty: number;
  shippingMode: string;
  productSubtotal: number;
  shippingCostFinal: number;
  totalFinal: number;
  status: string;
  lotId: string;
  paymentMethod?: PaymentMethod;
};

async function getReservation(reservationId: string): Promise<Reservation | null> {
  const snap = await db.collection("reservations").doc(reservationId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as any) };
}

function ErrorPage({ icon, title, description, ctaLabel, ctaHref }: {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow p-8 text-center max-w-md">
        <div className="text-5xl mb-3">{icon}</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-600 mb-4">{description}</p>
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function PagarReservaPage({
  params,
}: {
  params: { reservationId: string };
}) {
  const reservation = await getReservation(params.reservationId);
  const userId = cookies().get("userId")?.value;

  if (!reservation) {
    return <ErrorPage icon="❌" title="Reserva no encontrada" description="Este link no es válido o expiró." ctaLabel="Volver a explorar" ctaHref="/explorar" />;
  }
  if (!userId) {
    return <ErrorPage icon="🔒" title="Iniciá sesión para pagar" description="Necesitás estar logueado para acceder a tu reserva." ctaLabel="Iniciar sesión" ctaHref={`/login?role=retailer&redirect=/pagar/${reservation.id}`} />;
  }
  if (userId !== reservation.retailerId) {
    return <ErrorPage icon="🚫" title="No autorizado" description="Esta reserva no es tuya." />;
  }
  if (reservation.status === "paid") {
    return <ErrorPage icon="✅" title="Esta reserva ya fue pagada" description="Recibirás más información por email." ctaLabel="Ver mis pedidos" ctaHref="/dashboard/pedidos-fraccionados/pedidos" />;
  }
  if (reservation.status === "cancelled") {
    return <ErrorPage icon="❌" title="Reserva cancelada" description="Esta reserva fue cancelada." />;
  }
  if (reservation.status !== "lot_closed") {
    return <ErrorPage icon="⏳" title="El lote todavía no cerró" description="Esperá a que el lote alcance el mínimo. Te avisamos por email." ctaLabel="Volver a explorar" ctaHref="/explorar" />;
  }
  if (!reservation.paymentMethod) {
    return <ErrorPage icon="⚠️" title="Reserva sin método de pago" description="Esta reserva fue creada antes del nuevo sistema. Contactá al soporte." />;
  }

  const breakdown = getPriceBreakdown(reservation.totalFinal, reservation.paymentMethod);

  return (
    <PagarReservaClient
      reservationId={reservation.id}
      productName={reservation.productName}
      qty={reservation.qty}
      productSubtotal={reservation.productSubtotal}
      shippingCostFinal={reservation.shippingCostFinal}
      totalFinal={reservation.totalFinal}
      shippingMode={reservation.shippingMode}
      retailerName={reservation.retailerName}
      paymentMethod={reservation.paymentMethod}
      methodLabel={PAYMENT_METHODS_META[reservation.paymentMethod].label}
      surchargePercent={PAYMENT_METHODS_META[reservation.paymentMethod].surchargePercent}
      finalPriceWithSurcharge={breakdown.finalPrice}
      surchargeAmount={breakdown.surchargeAmount}
    />
  );
}