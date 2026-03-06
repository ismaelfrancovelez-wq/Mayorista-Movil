"use client";

// app/dashboard/fabricante/migrar/page.tsx
// ✅ 13 productos NUEVOS del archivo v7 (no estaban en v6)

import { useState, useRef } from "react";

const PRODUCTOS_NUEVOS = [
  {"name":"CAFAYATE Malbec 750ml","description":"CAFAYATE Malbec 750ml — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":3372.0,"minimumOrder":149,"unitLabel":"750ml","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x6","price":20232.0,"minimumOrder":25}]},
  {"name":"CAFAYATE Cabernet 750ml","description":"CAFAYATE Cabernet 750ml — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":3372.0,"minimumOrder":149,"unitLabel":"750ml","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x6","price":20232.0,"minimumOrder":25}]},
  {"name":"CAFAYATE Reserva Cabernet 750ml","description":"CAFAYATE Reserva Cabernet 750ml — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":5025.32,"minimumOrder":100,"unitLabel":"750ml","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x6","price":30151.92,"minimumOrder":17}]},
  {"name":"CAFAYATE Reserva Chardonnay 750ml","description":"CAFAYATE Reserva Chardonnay 750ml — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":5025.32,"minimumOrder":100,"unitLabel":"750ml","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x6","price":30151.92,"minimumOrder":17}]},
  {"name":"CAFAYATE Reserva Malbec 750ml","description":"CAFAYATE Reserva Malbec 750ml — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":5025.32,"minimumOrder":100,"unitLabel":"750ml","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x6","price":30151.92,"minimumOrder":17}]},
  {"name":"ETCHART PRIVADO Torrontes 750ml","description":"ETCHART PRIVADO Torrontes 750ml — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":2972.02,"minimumOrder":169,"unitLabel":"750ml","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x6","price":17832.12,"minimumOrder":29}]},
  {"name":"FABRE MONTMAYOU Terruño Cabernet 750ml","description":"FABRE MONTMAYOU Terruño Cabernet 750ml — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":8035.91,"minimumOrder":63,"unitLabel":"750ml","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x6","price":48215.46,"minimumOrder":11}]},
  {"name":"MUMM Espumante Domaine Extra Brut 750ml","description":"MUMM Espumante Domaine Extra Brut 750ml — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":9579.88,"minimumOrder":53,"unitLabel":"750ml","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x6","price":57479.28,"minimumOrder":9}]},
  {"name":"UVITA Tetra Blanco 1Lt","description":"UVITA Tetra Blanco 1Lt — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":1425.23,"minimumOrder":351,"unitLabel":"1Lt","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x12","price":17102.76,"minimumOrder":30}]},
  {"name":"UVITA Tetra Blanco Dulce 1Lt","description":"UVITA Tetra Blanco Dulce 1Lt — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":1425.23,"minimumOrder":351,"unitLabel":"1Lt","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x12","price":17102.76,"minimumOrder":30}]},
  {"name":"UVITA Tetra Tinto 1Lt","description":"UVITA Tetra Tinto 1Lt — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":1425.23,"minimumOrder":351,"unitLabel":"1Lt","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x12","price":17102.76,"minimumOrder":30}]},
  {"name":"UVITA Tetra Tinto Dulce 1Lt","description":"UVITA Tetra Tinto Dulce 1Lt — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":1425.23,"minimumOrder":351,"unitLabel":"1Lt","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x12","price":17102.76,"minimumOrder":30}]},
  {"name":"VIÑALBA Torrontes 750ml","description":"VIÑALBA Torrontes 750ml — producto de almacén mayorista de alta rotación. Ideal para revendedores y comercios minoristas.","price":4855.55,"minimumOrder":103,"unitLabel":"750ml","category":"bebidas","netProfitPerUnit":0,"stock":null,"variants":[{"unitLabel":"Pack x6","price":29133.3,"minimumOrder":18}]},
];

type MigResult = { name: string; status: "ok" | "error"; error?: string };

export default function MigrarProductosPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState("");
  const [log, setLog] = useState<{ msg: string; type: "ok" | "err" | "info" }[]>([]);
  const [results, setResults] = useState<MigResult[]>([]);
  const [defPickup, setDefPickup] = useState(true);
  const [defNoShipping, setDefNoShipping] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  function addLog(msg: string, type: "ok" | "err" | "info" = "info") {
    setLog(prev => [...prev, { msg, type }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }

  async function startMigration() {
    setStep(2);
    setLog([]);
    setProgress(0);
    setResults([]);

    const shipping = {
      methods: defPickup ? ["factory_pickup"] : [],
      noShipping: defNoShipping,
    };

    const res: MigResult[] = [];
    addLog(`🚀 Iniciando migración de ${PRODUCTOS_NUEVOS.length} productos nuevos...`, "info");

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
          addLog(`✅ [${i + 1}/${PRODUCTOS_NUEVOS.length}] ${p.name}`, "ok");
        } else {
          res.push({ name: p.name, status: "error", error: data.error });
          addLog(`❌ [${i + 1}/${PRODUCTOS_NUEVOS.length}] ${p.name}: ${data.error}`, "err");
        }
      } catch (e: any) {
        res.push({ name: p.name, status: "error", error: "Error de red" });
        addLog(`❌ [${i + 1}/${PRODUCTOS_NUEVOS.length}] ${p.name}: Error de red`, "err");
      }

      setProgress(Math.round(((i + 1) / PRODUCTOS_NUEVOS.length) * 100));
      if (i < PRODUCTOS_NUEVOS.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    setResults(res);
    addLog(`\n🏁 Listo. ✅ ${res.filter(r => r.status === "ok").length} creados · ❌ ${res.filter(r => r.status === "error").length} con error`, "info");
    setTimeout(() => setStep(3), 1000);
  }

  const ok = results.filter(r => r.status === "ok");
  const err = results.filter(r => r.status === "error");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center gap-3 sticky top-0 z-50">
        <span className="text-xl">📦</span>
        <div>
          <h1 className="font-bold text-base leading-tight">Migrador de Productos</h1>
          <p className="text-xs text-gray-500">13 productos nuevos · v7 vs v6</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* PASO 1 — CONFIRMAR */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold mb-1">13 productos nuevos detectados</h2>
              <p className="text-sm text-gray-400">
                Todos de <strong className="text-white">Vinos y Espumantes</strong> — no estaban en la lista anterior.
              </p>
            </div>

            {/* Lista de productos nuevos */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
              {PRODUCTOS_NUEVOS.map((p, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-200">{p.name}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs font-mono text-emerald-400">${p.price.toLocaleString("es-AR")}</span>
                      <span className="text-xs font-mono text-amber-400">mín {p.minimumOrder}</span>
                      <span className="text-xs font-mono text-violet-400">{p.variants[0]?.unitLabel} · ${p.variants[0]?.price.toLocaleString("es-AR")}</span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-blue-900/30 border border-blue-500/20 text-blue-400 shrink-0">nuevo</span>
                </div>
              ))}
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

            <button
              onClick={startMigration}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-4 rounded-xl transition-all text-base"
            >
              🚀 Migrar 13 productos nuevos
            </button>
          </div>
        )}

        {/* PASO 2 — MIGRANDO */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold mb-1">Migrando...</h2>
              <p className="text-sm text-gray-400">No cerrés esta pestaña.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex justify-between text-xs font-mono text-gray-500 mb-2">
                <span className="truncate text-gray-300 max-w-xs">{current || "Iniciando..."}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div ref={logRef} className="bg-gray-950 border border-gray-800 rounded-xl p-4 font-mono text-xs space-y-0.5 max-h-72 overflow-y-auto">
              {log.map((e, i) => (
                <div key={i} className={e.type === "ok" ? "text-emerald-400" : e.type === "err" ? "text-red-400" : "text-gray-500"}>{e.msg}</div>
              ))}
            </div>
          </div>
        )}

        {/* PASO 3 — RESULTADO */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="text-center py-6">
              <div className="text-5xl mb-3">{err.length === 0 ? "🎉" : ok.length > 0 ? "⚠️" : "❌"}</div>
              <h2 className="text-2xl font-bold mb-2">
                {err.length === 0 ? "¡Migración exitosa!" : ok.length > 0 ? "Migración parcial" : "Hubo errores"}
              </h2>
              <p className="text-sm text-gray-400">
                {ok.length} productos creados{err.length > 0 ? ` · ${err.length} con error` : ""}
              </p>
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
              <div className="bg-gray-900 border border-red-500/20 rounded-xl p-4">
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
            <a href="/dashboard/fabricante/productos" className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-xl transition-all text-base text-center">
              Ver mis productos →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}