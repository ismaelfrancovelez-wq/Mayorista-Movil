"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigimos fijo (NO productId)
    const timeout = setTimeout(() => {
      router.push("/products/test");
    }, 3000);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div style={{ padding: 40 }}>
      <h1>✅ Pago aprobado</h1>
      <p>Redirigiendo al producto...</p>
    </div>
  );
}