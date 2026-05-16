// app/dashboard/pedidos-fraccionados/layout.tsx
//
// ✅ REFACTOR (Fase 1):
// - Sacada la lectura de retailer (badges, racha, level, score) desde Firestore.
// - Ya no necesitamos buscar en /retailers/{id} para mostrar el header,
//   solo necesitamos email y nombre que vienen de cookies o /users.

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

  // Solo leer /users si no tenemos el nombre en cookie
  let userName = cookieUserName;
  if (!userName) {
    const userSnap = await db.collection("users").doc(userId).get();
    userName = userSnap.data()?.name || "";
  }

  return (
    <>
      <RetailerNavBar
        userEmail={userEmail}
        userName={userName}
      />
      <div className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </div>
    </>
  );
}