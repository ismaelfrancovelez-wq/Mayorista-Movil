"use client";

import { useState, useEffect } from "react";

const VALID_CATEGORIES: Record<string, string> = {
  alimentos: "Alimentos y Bebidas",
  bebidas: "Bebidas",
  indumentaria: "Indumentaria",
  calzado: "Calzado",
  electronica: "Electrónica",
  hogar: "Hogar y Decoración",
  construccion: "Construcción y Ferretería",
  salud_belleza: "Salud y Belleza",
  jugueteria: "Juguetería",
  limpieza: "Limpieza",
  deportes: "Deportes y Fitness",
  automotor: "Automotor",
  mascotas: "Mascotas",
  otros: "Otros",
};

interface CategoryEntry {
  value: string;
  count: number;
  examples: string[];
}

export default function CategoryAuditClient() {
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function loadAudit() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/category-audit");
      const data = await res.json();
      setCategories(data.categories ?? []);
      setTotal(data.total ?? 0);
      // Pre-inicializar mapping con las entradas inválidas
      const initial: Record<string, string> = {};
      for (const entry of data.categories ?? []) {
        if (!VALID_CATEGORIES[entry.value]) {
          initial[entry.value] = "otros";
        }
      }
      setMapping(initial);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAudit(); }, []);

  async function applyFix() {
    const toFix = Object.fromEntries(
      Object.entries(mapping).filter(([k]) => !VALID_CATEGORIES[k])
    );
    if (Object.keys(toFix).length === 0) {
      setResult("No hay nada que corregir.");
      return;
    }
    setFixing(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/fix-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping: toFix }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(`✅ ${data.totalUpdated} productos actualizados.`);
        loadAudit();
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } finally {
      setFixing(false);
    }
  }

  const invalidEntries = categories.filter(e => !VALID_CATEGORIES[e.value]);
  const validEntries = categories.filter(e => VALID_CATEGORIES[e.value]);

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Auditoría de Categorías</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Total productos en Firestore: <strong>{total}</strong>
      </p>

      {loading && <p className="text-blue-600">Cargando...</p>}

      {invalidEntries.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-red-700 mb-3">
            ⚠️ Valores inválidos ({invalidEntries.length})
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Estos valores no coinciden con ninguna categoría válida del sistema. Asignales la categoría correcta y hacé clic en "Aplicar corrección".
          </p>
          <div className="space-y-3">
            {invalidEntries.map(entry => (
              <div key={entry.value} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-red-800 font-semibold text-sm">
                      {entry.value === "__null__" ? "(sin categoría / null)" : `"${entry.value}"`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {entry.count} producto{entry.count !== 1 ? "s" : ""} · Ej: {entry.examples.join(", ")}
                    </p>
                  </div>
                  <select
                    className="border rounded px-3 py-1.5 text-sm min-w-[200px]"
                    value={mapping[entry.value] ?? "otros"}
                    onChange={e => setMapping(prev => ({ ...prev, [entry.value]: e.target.value }))}
                  >
                    {Object.entries(VALID_CATEGORIES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={applyFix}
            disabled={fixing}
            className="mt-5 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {fixing ? "Aplicando..." : "Aplicar corrección"}
          </button>

          {result && (
            <p className="mt-3 text-sm font-medium text-gray-700">{result}</p>
          )}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-green-700 mb-3">
          ✅ Categorías válidas
        </h2>
        <div className="space-y-2">
          {validEntries.map(entry => (
            <div key={entry.value} className="flex justify-between items-center bg-white border rounded-lg px-4 py-2 text-sm">
              <span className="font-medium text-gray-800">
                {VALID_CATEGORIES[entry.value]} <span className="text-gray-400 font-normal">({entry.value})</span>
              </span>
              <span className="text-gray-500 font-semibold">{entry.count}</span>
            </div>
          ))}
          {validEntries.length === 0 && !loading && (
            <p className="text-gray-400 text-sm">No hay productos con categorías válidas todavía.</p>
          )}
        </div>
      </div>

      <button
        onClick={loadAudit}
        disabled={loading}
        className="mt-6 text-sm text-blue-600 hover:underline disabled:opacity-50"
      >
        Recargar auditoría
      </button>
    </div>
  );
}
