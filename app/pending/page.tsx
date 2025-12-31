"use client";

import { useRouter } from "next/navigation";

export default function PendingPage() {
  const router = useRouter();

  return (
    <div style={{ padding: 40 }}>
      <h1>⏳ Pago pendiente</h1>
      <button onClick={() => router.push("/products/test")}>
        Volver al producto
      </button>
    </div>
  );
}