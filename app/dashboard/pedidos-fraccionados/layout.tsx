// app/dashboard/pedidos-fraccionados/layout.tsx
// ✅ ACTUALIZADO: sin sidebar, con barra horizontal + UserRoleHeader completo

import { cookies } from "next/headers";
import { db } from "../../../lib/firebase-admin";
import RetailerNavBar from "../../../components/RetailerNavBar";

export default async function RevendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const userId = cookieStore.get("userId")?.value;
  const activeRole = cookieStore.get("activeRole")?.value;

  if (!userId || activeRole !== "retailer") {
    return <>{children}</>;
  }

  const userEmail = cookieStore.get("userEmail")?.value || "";
  const cookieUserName = cookieStore.get("userName")?.value || "";

  const [userSnap, retailerSnap] = await Promise.all([
    db.collection("users").doc(userId).get(),
    db.collection("retailers").doc(userId).get(),
  ]);

  const userName = cookieUserName || userSnap.data()?.name || "";
  const retailerData = retailerSnap.data() || {};

  return (
    <>
      <RetailerNavBar
        userEmail={userEmail}
        userName={userName}
        milestoneBadges={retailerData.milestoneBadges ?? []}
        streakBadges={retailerData.streakBadges ?? []}
        currentStreak={retailerData.currentStreak ?? 0}
        paymentLevel={retailerData.paymentLevel ?? 2}
        completedLots={retailerData.completedReservations ?? 0}
        scoreValue={retailerData.scoreAggregate?.score ?? 0.5}
      />
      <div className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </div>
    </>
  );
}