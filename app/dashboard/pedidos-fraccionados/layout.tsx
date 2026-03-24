// app/dashboard/pedidos-fraccionados/layout.tsx
// ✅ ACTUALIZADO: sin sidebar, con barra de navegación horizontal superior

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

  // Si no es retailer, renderiza sin barra
  if (!userId || activeRole !== "retailer") {
    return <>{children}</>;
  }

  const userEmail = cookieStore.get("userEmail")?.value || "";
  const cookieUserName = cookieStore.get("userName")?.value || "";

  // Solo si no hay nombre en cookie lo buscamos en Firestore
  let userName = cookieUserName;
  if (!userName) {
    const userSnap = await db.collection("users").doc(userId).get();
    userName = userSnap.data()?.name || "";
  }

  return (
    <>
      <RetailerNavBar userEmail={userEmail} userName={userName} />
      <div className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </div>
    </>
  );
}