// app/admin/export/page.tsx
"use client";
import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase-client";
import { collection, getDocs } from "firebase/firestore";

export default function ExportPage() {
  const [status, setStatus] = useState("idle");

  async function handleExport() {
    setStatus("cargando...");
    const snapshot = await getDocs(collection(db, "products"));
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-export.json";
    a.click();
    setStatus(`Listo — ${products.length} productos exportados`);
  }

  return (
    <div style={{ padding: 40 }}>
      <button onClick={handleExport}>Exportar productos</button>
      <p>{status}</p>
    </div>
  );
}