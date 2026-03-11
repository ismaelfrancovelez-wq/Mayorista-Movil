"use client";

import { useState, useRef } from "react";

// 1401 productos de newredmayorista.com.ar — SOLO AGREGA, no borra los anteriores
const PRODUCTOS_NUEVOS = [
  {"name":"3 en 1 SANDW+DONERA+WAFLERA ORYX","description":"3 en 1 SANDW+DONERA+WAFLERA ORYX — mayorista New Red.","price":37894.74,"minimumOrder":3,"unitLabel":null,"category":"electronica","netProfitPerUnit":0,"stock":null,"imageUrls":["https://newredmayorista.com.ar/wp-content/uploads/2025/08/D_NQ_NP_843946-MLC70142467081_062023-O.webp"],"variants":[]},
  {"name":"VENTILADOR TURBO MAGICLICK 20″","description":"VENTILADOR TURBO MAGICLICK 20″ — mayorista New Red.","price":26000.0,"minimumOrder":3,"unitLabel":null,"category":"electronica","netProfitPerUnit":0,"stock":null,"imageUrls":["https://newredmayorista.com.ar/wp-content/uploads/2025/09/D_NQ_NP_2X_871861-MLA91873518041_092025-F.webp"],"variants":[]},
  {"name":"WAFLERA CUADRADA 750W SUONO HOG0227","description":"WAFLERA CUADRADA 750W SUONO HOG0227 — mayorista New Red.","price":17400.0,"minimumOrder":3,"unitLabel":null,"category":"electronica","netProfitPerUnit":0,"stock":null,"imageUrls":["https://newredmayorista.com.ar/wp-content/uploads/2025/06/Captura-de-pantalla-2025-06-09-171813.jpg"],"variants":[]},
  {"name":"WAFLERA ELECTRICA DINAX SAN700B","description":"WAFLERA ELECTRICA DINAX SAN700B — mayorista New Red.","price":15578.95,"minimumOrder":3,"unitLabel":null,"category":"electronica","netProfitPerUnit":0,"stock":null,"imageUrls":["https://newredmayorista.com.ar/wp-content/uploads/2026/01/unnamed-16.jpg"],"variants":[]},
  {"name":"YOGURTERA BASICA SUONO 7 VASOS HOG0251","description":"YOGURTERA BASICA SUONO 7 VASOS HOG0251 — mayorista New Red.","price":21500.0,"minimumOrder":3,"unitLabel":null,"category":"electronica","netProfitPerUnit":0,"stock":null,"imageUrls":["https://newredmayorista.com.ar/wp-content/uploads/2025/10/Captura-de-pantalla-2025-10-02-112130.jpg"],"variants":[]}
];

type MigResult = { name: string; status: "ok" | "error"; error?: string };

export default function MigrarNewRedPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState("");
  const [log, setLog] = useState<{ msg: string; type: "ok" | "err" | "info" | "warn" }[]>([]);
  const [results, setResults] = useState<MigResult[]>([]);
  const [defPickup, setDefPickup] = useState(true);
  const [defNoShipping, setDefNoShipping] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  function addLog(msg: string, type: "ok" | "err" | "info" | "warn" = "info") {
    setLog(prev => [...prev, { msg, type }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }

  async function startProcess() {
    setStep(2); setLog([]); setProgress(0); setResults([]);
    addLog(`🚀 Migrando 1401 productos de New Red Mayorista...`, "info");
    addLog("⚡ No se borra nada — solo se agregan productos nuevos.", "info");

    const shipping = { methods: defPickup ? ["factory_pickup"] : [], noShipping: defNoShipping };
    const res: MigResult[] = [];

    for (let i = 0; i < PRODUCTOS_NUEVOS.length; i++) {
      const p = PRODUCTOS_NUEVOS[i];
      setCurrent(p.name);
      try {
        const r = await fetch("/api/products/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...p, shipping }),
        });
        const data = await r.json();
        if (r.ok && data.success) {
          res.push({ name: p.name, status: "ok" });
          if ((i + 1) % 20 === 0 || i === PRODUCTOS_NUEVOS.length - 1)
            addLog(`✅ Creados ${i + 1}/1401...`, "ok");
        } else {
          res.push({ name: p.name, status: "error", error: data.error });
          addLog(`❌ ${p.name}: ${data.error}`, "err");
        }
      } catch {
        res.push({ name: p.name, status: "error", error: "Error de red" });
        addLog(`❌ ${p.name}: Error de red`, "err");
      }
      setProgress(Math.round(((i + 1) / PRODUCTOS_NUEVOS.length) * 100));
      await new Promise(r => setTimeout(r, 300));
    }

    setResults(res);
    const okCount = res.filter(r => r.status === "ok").length;
    const errCount = res.filter(r => r.status === "error").length;
    addLog(`\n🏁 Listo. ✅ ${okCount} creados · ❌ ${errCount} con error`, "info");
    setTimeout(() => setStep(3), 800);
  }

  const ok = results.filter(r => r.status === "ok");
  const err = results.filter(r => r.status === "error");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center gap-3 sticky top-0 z-50">
        <span className="text-xl">➕</span>
        <div>
          <h1 className="font-bold text-base leading-tight">Agregar — New Red Mayorista</h1>
          <p className="text-xs text-gray-500">Agrega 1401 productos · Mínimo 3 unidades por producto</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold mb-1">Agregar 1401 productos</h2>
              <p className="text-sm text-gray-400">Solo agrega — <strong className="text-white">no borra</strong> ningún producto existente.</p>
            </div>
            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 flex gap-3">
              <span className="text-2xl">📦</span>
              <div>
                <p className="font-semibold text-emerald-300 text-sm">New Red Mayorista</p>
                <p className="text-xs text-gray-400 mt-0.5">Mínimo 3 unidades por producto · Todos con imagen.</p>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">Envío por defecto</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={defPickup} onChange={e => setDefPickup(e.target.checked)} className="accent-violet-500" />
                  <span className="text-gray-300">Retiro en fábrica</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={defNoShipping} onChange={e => setDefNoShipping(e.target.checked)} className="accent-violet-500" />
                  <span className="text-gray-300">Sin envíos (solo fraccionado)</span>
                </label>
              </div>
            </div>
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300">
              ⚠️ 1401 productos · ~7-8 minutos. No cerrés la pestaña.
            </div>
            <button onClick={startProcess}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-xl transition-all text-base">
              ➕ Agregar 1401 productos de New Red Mayorista
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold mb-1">📦 Migrando productos...</h2>
              <p className="text-sm text-gray-400">No cerrés esta pestaña.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex justify-between text-xs font-mono text-gray-500 mb-2">
                <span className="truncate text-gray-300 max-w-xs">{current || "Iniciando..."}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-violet-500 to-emerald-500"
                  style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div ref={logRef} className="bg-gray-950 border border-gray-800 rounded-xl p-4 font-mono text-xs space-y-0.5 max-h-72 overflow-y-auto">
              {log.map((e, i) => (
                <div key={i} className={
                  e.type === "ok" ? "text-emerald-400" :
                  e.type === "err" ? "text-red-400" :
                  e.type === "warn" ? "text-amber-400" : "text-gray-500"
                }>{e.msg}</div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="text-center py-6">
              <div className="text-5xl mb-3">{err.length === 0 ? "🎉" : ok.length > 0 ? "⚠️" : "❌"}</div>
              <h2 className="text-2xl font-bold mb-2">
                {err.length === 0 ? "¡Catálogo agregado!" : ok.length > 0 ? "Migración parcial" : "Hubo errores"}
              </h2>
              <p className="text-sm text-gray-400">{ok.length} productos creados{err.length > 0 ? ` · ${err.length} con error` : ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold font-mono text-emerald-400">{ok.length}</div>
                <div className="text-xs text-gray-500 mt-1">creados</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold font-mono text-red-400">{err.length}</div>
                <div className="text-xs text-gray-500 mt-1">con error</div>
              </div>
            </div>
            {err.length > 0 && (
              <div className="bg-gray-900 border border-red-500/20 rounded-xl p-4 max-h-64 overflow-y-auto">
                <p className="text-xs text-red-400 font-mono uppercase tracking-widest mb-3">❌ Errores</p>
                <div className="space-y-1.5">
                  {err.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-300 truncate">{r.name}</span>
                      <span className="text-red-400 font-mono shrink-0">{r.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <a href="/dashboard/fabricante/productos"
              className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-xl transition-all text-base text-center">
              Ver mis productos →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}