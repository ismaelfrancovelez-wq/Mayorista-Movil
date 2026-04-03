"use client";

// app/admin/categorias/page.tsx

import { useState, useEffect } from "react";

const VALID_CATEGORIES: Record<string, string> = {
  alimentos:     "Alimentos y Bebidas",
  bebidas:       "Bebidas",
  indumentaria:  "Indumentaria",
  calzado:       "Calzado",
  electronica:   "Electrónica",
  hogar:         "Hogar y Decoración",
  construccion:  "Construcción y Ferretería",
  salud_belleza: "Salud y Belleza",
  jugueteria:    "Juguetería",
  libreria:      "Librería y Oficina",
  deportes:      "Deportes y Fitness",
  automotor:     "Automotor",
  mascotas:      "Mascotas",
  otros:         "Otros",
};

const VALID_KEYS = Object.keys(VALID_CATEGORIES);

interface AuditRow { value: string; count: number; examples: string[]; }

export default function CategoriasAdminPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateResult, setActivateResult] = useState<string | null>(null);

  async function loadAudit() {
    setLoading(true); setError(null);
    try {
      const data = await fetch("/api/admin/category-audit").then(r => r.json());
      if (data.error) { setError(data.error); return; }
      setTotal(data.total);
      setRows(data.categories);
    } catch { setError("Error al cargar. ¿Sos admin y tenés sesión activa?"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAudit(); }, []);

  const incorrectRows = rows.filter(r => !VALID_KEYS.includes(r.value));
  const correctRows   = rows.filter(r =>  VALID_KEYS.includes(r.value));
  const pendingFix    = incorrectRows.filter(r => !!mapping[r.value]);
  const unmapped      = incorrectRows.filter(r => !mapping[r.value]);

  async function handleActivate() {
    setActivating(true); setActivateResult(null);
    try {
      const res = await fetch("/api/admin/activate-products", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setActivateResult(`Error: ${data.error}`); return; }
      setActivateResult(`✅ ${data.message}`);
    } catch { setActivateResult("❌ Error de red."); }
    finally { setActivating(false); }
  }

  async function handleFix() {
    if (pendingFix.length === 0) return;
    setFixing(true); setFixResult(null);
    const fixMap: Record<string, string> = {};
    for (const row of pendingFix) fixMap[row.value] = mapping[row.value];
    try {
      const res = await fetch("/api/admin/fix-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping: fixMap }),
      });
      const data = await res.json();
      if (!res.ok) { setFixResult(`Error: ${data.error}`); return; }
      setFixResult(`✅ ${data.totalUpdated} productos actualizados.`);
      setMapping({});
      await loadAudit();
    } catch { setFixResult("❌ Error de red."); }
    finally { setFixing(false); }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Cargando...</p></div>;
  if (error)   return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl">{error}</div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-1">Auditoría de categorías</h1>
        <p className="text-sm text-gray-400 mb-6">{total} productos en total</p>

        {/* ACTIVAR PRODUCTOS */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="font-semibold mb-1">Activar productos en el explorador</h2>
          <p className="text-xs text-gray-400 mb-4">
            Setea <code>active=true</code> en todos los productos que no lo tengan. Solo necesitás correr esto una vez.
          </p>
          <button
            onClick={handleActivate}
            disabled={activating}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {activating ? "Activando..." : "Activar todos los productos"}
          </button>
          {activateResult && (
            <p className="mt-3 text-sm text-gray-700">{activateResult}</p>
          )}
        </div>

        {/* CATEGORÍAS INCORRECTAS */}
        {incorrectRows.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
            <p className="text-green-800 font-medium">✅ Todas las categorías están correctas.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow p-6 mb-6">
            <h2 className="font-semibold text-red-700 mb-1">
              {incorrectRows.length} categoría{incorrectRows.length > 1 ? "s" : ""} con valor incorrecto
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Para cada una, elegí la categoría correcta y hacé clic en "Aplicar".
            </p>

            <div className="space-y-3 mb-5">
              {incorrectRows.map(row => (
                <div key={row.value} className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-bold text-red-800">
                        "{row.value === "__null__" ? "(sin categoría)" : row.value}"
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {row.count} producto{row.count > 1 ? "s" : ""}
                        {row.examples.length > 0 && <span className="text-gray-400"> — {row.examples.join(", ")}</span>}
                      </p>
                    </div>
                    <span className="text-gray-300 text-xl">→</span>
                    <select
                      className="border rounded-lg px-3 py-1.5 text-sm bg-white"
                      value={mapping[row.value] ?? ""}
                      onChange={e => setMapping(prev => ({ ...prev, [row.value]: e.target.value }))}
                    >
                      <option value="">Elegir categoría...</option>
                      {VALID_KEYS.map(key => (
                        <option key={key} value={key}>{VALID_CATEGORIES[key]}</option>
                      ))}
                    </select>
                  </div>
                  {mapping[row.value] && (
                    <p className="text-xs text-green-700 mt-2">
                      Se cambiará a: <strong>{VALID_CATEGORIES[mapping[row.value]]}</strong>
                    </p>
                  )}
                </div>
              ))}
            </div>

            {unmapped.length > 0 && (
              <p className="text-xs text-amber-600 mb-3">
                ⚠️ Faltan asignar {unmapped.length} — podés aplicar las ya asignadas igual.
              </p>
            )}

            <button
              onClick={handleFix}
              disabled={fixing || pendingFix.length === 0}
              className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition text-sm"
            >
              {fixing ? "Aplicando..." : `Aplicar ${pendingFix.length} corrección${pendingFix.length !== 1 ? "es" : ""}`}
            </button>

            {fixResult && (
              <p className={`mt-3 text-sm font-medium ${fixResult.startsWith("✅") ? "text-green-700" : "text-red-700"}`}>
                {fixResult}
              </p>
            )}
          </div>
        )}

        {/* DISTRIBUCIÓN ACTUAL */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Distribución actual</h2>
          <div className="space-y-3">
            {correctRows.sort((a, b) => b.count - a.count).map(row => {
              const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
              return (
                <div key={row.value}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{VALID_CATEGORIES[row.value]}</span>
                    <span className="text-sm font-semibold text-gray-500">
                      {row.count} <span className="font-normal text-gray-400">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-0.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  {row.examples.length > 0 && (
                    <p className="text-xs text-gray-400">{row.examples.join(" · ")}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
